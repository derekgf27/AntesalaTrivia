import { randomUUID } from "crypto";
import { SAMPLE_QUESTIONS } from "./sampleQuestions";
import { titleFromScheduledDate, toDateInputValue } from "./dateUtils";
import {
  findNightByCode,
  findOpenNight,
  upsertNight,
} from "./nightHistory";
import {
  assertStoreReady,
  getCurrentCode,
  getRoomData,
  setCurrentCode,
  setRoomData,
  withLock,
} from "./persist";
import type {
  AdminGameState,
  CreateNightInput,
  GamePhase,
  NightRecord,
  Player,
  PublicGameState,
  Question,
  RevealInfo,
  Team,
} from "./types";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REVEAL_DELAY_MS = 2500;
const ONLINE_MS = 20_000;

function generateCode(length = 4): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export type GameRoom = {
  id: string;
  code: string;
  title: string;
  scheduledDate: string;
  expectedTeams: number;
  createdAt: string;
  phase: GamePhase;
  questions: Question[];
  questionIndex: number;
  timerEndsAt: number | null;
  timerPausedRemainingMs: number | null;
  timeLimitSec: number;
  teams: Team[];
  players: Record<string, Player>;
  currentAnswers: Record<string, number>;
  reveal: RevealInfo | null;
  lockedAt: number | null;
};

function cloneQuestions(questions: Question[]): Question[] {
  return questions.map((q) => ({
    ...q,
    options: [...q.options] as Question["options"],
  }));
}

export function advanceTimers(room: GameRoom) {
  const now = Date.now();
  if (
    room.phase === "question" &&
    room.timerPausedRemainingMs == null &&
    room.timerEndsAt &&
    now >= room.timerEndsAt
  ) {
    lockAnswers(room);
  }
  if (room.phase === "locked") {
    if (!room.lockedAt) room.lockedAt = now;
    if (now >= room.lockedAt + REVEAL_DELAY_MS) {
      revealAnswers(room);
    }
  }
}

function toNightRecord(room: GameRoom): NightRecord {
  return {
    id: room.id,
    title: room.title,
    scheduledDate: room.scheduledDate,
    code: room.code,
    expectedTeams: room.expectedTeams,
    createdAt: room.createdAt,
    finishedAt: room.phase === "finished" ? new Date().toISOString() : null,
    phase: room.phase,
    teams: [...room.teams].sort(
      (a, b) => b.score - a.score || a.name.localeCompare(b.name),
    ),
    questions: room.questions,
    questionIndex: room.questionIndex,
    reveal: room.reveal,
    timeLimitSec: room.timeLimitSec,
  };
}

async function persistRoom(room: GameRoom) {
  await setRoomData(room.code, room);
  if (room.phase !== "finished") await setCurrentCode(room.code);
  await upsertNight(toNightRecord(room));
}

function restoreFromRecord(record: NightRecord): GameRoom {
  const code = record.code.toUpperCase().trim();
  const hasQuestions = Boolean(record.questions?.length);
  const questions = hasQuestions
    ? cloneQuestions(record.questions!)
    : SAMPLE_QUESTIONS.map((q) => ({ ...q, id: randomUUID() }));

  let phase = (record.phase as GamePhase) || "lobby";
  let questionIndex =
    typeof record.questionIndex === "number" ? record.questionIndex : -1;

  if (phase === "question" || phase === "locked") {
    phase = questionIndex >= 0 ? "reveal" : "lobby";
  }
  if (!hasQuestions && phase !== "finished") {
    phase = "lobby";
    questionIndex = -1;
  }
  if (phase === "lobby") questionIndex = -1;

  return {
    id: record.id,
    code,
    title: record.title,
    scheduledDate:
      record.scheduledDate ||
      record.createdAt?.slice(0, 10) ||
      toDateInputValue(),
    expectedTeams: record.expectedTeams || 64,
    createdAt: record.createdAt,
    phase,
    questions,
    questionIndex,
    timerEndsAt: null,
    timerPausedRemainingMs: null,
    timeLimitSec: Math.max(
      5,
      Math.min(
        180,
        record.timeLimitSec || record.questions?.[0]?.timeLimitSec || 30,
      ),
    ),
    teams: (record.teams || []).map((t) => ({ ...t })),
    players: {},
    currentAnswers: {},
    reveal:
      phase === "reveal" || phase === "finished" ? (record.reveal ?? null) : null,
    lockedAt: null,
  };
}

export function toPublic(room: GameRoom): PublicGameState {
  const q =
    room.phase === "lobby" || room.questionIndex < 0
      ? null
      : room.questions[room.questionIndex];

  return {
    code: room.code,
    title: room.title,
    scheduledDate: room.scheduledDate,
    expectedTeams: room.expectedTeams,
    phase: room.phase,
    questionIndex: Math.max(0, room.questionIndex),
    questionCount: room.questions.length,
    question: q
      ? {
          id: q.id,
          text: q.text,
          options: q.options,
          timeLimitSec: room.timeLimitSec,
        }
      : null,
    timerEndsAt: room.timerEndsAt,
    timerPaused: room.timerPausedRemainingMs != null,
    timerPausedRemainingMs: room.timerPausedRemainingMs,
    timeLimitSec: room.timeLimitSec,
    teams: [...room.teams].sort(
      (a, b) => b.score - a.score || a.name.localeCompare(b.name),
    ),
    reveal:
      room.phase === "reveal" || room.phase === "finished" ? room.reveal : null,
    answeredTeamIds: Object.keys(room.currentAnswers),
  };
}

export function toAdmin(room: GameRoom): AdminGameState {
  const now = Date.now();
  const connectedTeamIds = [
    ...new Set(
      Object.values(room.players)
        .filter((p) => now - p.lastSeenAt < ONLINE_MS)
        .map((p) => p.teamId),
    ),
  ];
  return {
    ...toPublic(room),
    id: room.id,
    questions: room.questions,
    currentAnswers: { ...room.currentAnswers },
    createdAt: room.createdAt,
    reveal: room.reveal,
    connectedTeamIds,
  };
}

function lockAnswers(room: GameRoom) {
  if (room.phase !== "question") return;
  room.phase = "locked";
  room.timerEndsAt = null;
  room.timerPausedRemainingMs = null;
  room.reveal = null;
  room.lockedAt = Date.now();
}

function revealAnswers(room: GameRoom) {
  if (room.phase !== "locked" && room.phase !== "question") return;
  const q = room.questions[room.questionIndex];
  const awarded: RevealInfo["awarded"] = [];

  for (const [teamId, answer] of Object.entries(room.currentAnswers)) {
    if (answer === q.correctIndex) {
      const team = room.teams.find((t) => t.id === teamId);
      if (team) {
        team.score += 1;
        awarded.push({ teamId, points: 1 });
      }
    }
  }

  room.reveal = { correctIndex: q.correctIndex, awarded };
  room.phase = "reveal";
  room.timerEndsAt = null;
  room.timerPausedRemainingMs = null;
  room.lockedAt = null;
}

function armQuestionTimer(room: GameRoom, ms: number) {
  room.timerPausedRemainingMs = null;
  room.lockedAt = null;
  room.timerEndsAt = Date.now() + ms;
}

function startQuestionOnRoom(room: GameRoom): "started" | "finished" {
  if (room.phase === "finished") throw new Error("Game already finished");
  if (room.phase === "question" || room.phase === "locked") {
    throw new Error("Question already in progress");
  }

  const nextIndex = room.questionIndex + 1;
  if (nextIndex >= room.questions.length) {
    room.phase = "finished";
    room.timerEndsAt = null;
    room.timerPausedRemainingMs = null;
    room.lockedAt = null;
    return "finished";
  }

  room.questionIndex = nextIndex;
  room.phase = "question";
  room.currentAnswers = {};
  room.reveal = null;
  armQuestionTimer(room, Math.max(5, room.timeLimitSec) * 1000);
  return "started";
}

class GameStore {
  async loadRoom(code: string): Promise<GameRoom | undefined> {
    const live = await getRoomData<GameRoom>(code);
    if (!live) return undefined;
    if (!live.players) live.players = {};
    if (!live.currentAnswers) live.currentAnswers = {};
    advanceTimers(live);
    return live;
  }

  async getRoom(code: string): Promise<GameRoom | undefined> {
    return this.loadRoom(code);
  }

  async snapshot(
    code: string,
    opts?: { playerId?: string; admin?: boolean },
  ): Promise<PublicGameState | AdminGameState> {
    assertStoreReady();
    return withLock(code.toUpperCase(), async () => {
      const room = await this.getRoomOrRestore(code);
      if (!room) throw new Error("Game not found");
      advanceTimers(room);
      if (opts?.playerId && room.players[opts.playerId]) {
        room.players[opts.playerId].lastSeenAt = Date.now();
      }
      await persistRoom(room);
      return opts?.admin ? toAdmin(room) : toPublic(room);
    });
  }

  async save(room: GameRoom) {
    await persistRoom(room);
  }

  async mutate<T>(
    code: string,
    fn: (room: GameRoom) => T | Promise<T>,
  ): Promise<T> {
    assertStoreReady();
    return withLock(code.toUpperCase(), async () => {
      const room = await this.loadRoom(code);
      if (!room) throw new Error("Game not found");
      const result = await fn(room);
      await persistRoom(room);
      return result;
    });
  }

  async createRoom(
    input: CreateNightInput = {
      scheduledDate: toDateInputValue(),
      expectedTeams: 64,
    },
  ): Promise<GameRoom> {
    assertStoreReady();
    let code = generateCode();
    while (await getRoomData(code)) code = generateCode();

    const rawDate = input.scheduledDate?.trim() || "";
    const scheduledDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : toDateInputValue();
    const expectedTeams = Math.max(
      1,
      Math.min(64, Math.floor(input.expectedTeams) || 64),
    );

    const room: GameRoom = {
      id: randomUUID(),
      code,
      title: titleFromScheduledDate(scheduledDate),
      scheduledDate,
      expectedTeams,
      createdAt: new Date().toISOString(),
      phase: "lobby",
      questions:
        input.questions && input.questions.length > 0
          ? cloneQuestions(input.questions)
          : SAMPLE_QUESTIONS.map((q) => ({ ...q, id: randomUUID() })),
      questionIndex: -1,
      timerEndsAt: null,
      timerPausedRemainingMs: null,
      timeLimitSec: 30,
      teams: [],
      players: {},
      currentAnswers: {},
      reveal: null,
      lockedAt: null,
    };

    await persistRoom(room);
    return room;
  }

  async hydrateOpenNight(): Promise<GameRoom | undefined> {
    const current = await getCurrentCode();
    if (current) {
      const live = await this.loadRoom(current);
      if (live && live.phase !== "finished") return live;
    }
    const open = await findOpenNight();
    if (!open) return undefined;
    return this.restoreRoom(open);
  }

  async getRoomOrRestore(code: string): Promise<GameRoom | undefined> {
    const live = await this.loadRoom(code);
    if (live) return live;
    const record = await findNightByCode(code);
    if (!record) return undefined;
    if (record.finishedAt || record.phase === "finished") return undefined;
    return this.restoreRoom(record);
  }

  async restoreRoom(record: NightRecord): Promise<GameRoom> {
    const existing = await this.loadRoom(record.code);
    if (existing) return existing;
    const room = restoreFromRecord(record);
    await persistRoom(room);
    return room;
  }

  async touchPlayer(code: string, playerId: string) {
    const room = await this.loadRoom(code);
    if (!room) return;
    const player = room.players[playerId];
    if (!player) return;
    player.lastSeenAt = Date.now();
    await persistRoom(room);
  }

  addPlayer(
    room: GameRoom,
    opts: {
      playerName: string;
      mode: "solo" | "createTeam" | "joinTeam";
      teamName?: string;
      teamId?: string;
      playerId?: string;
    },
  ): { player: Player; team: Team } {
    const name = opts.playerName.trim().slice(0, 24) || "Player";
    const now = Date.now();

    if (opts.playerId && room.players[opts.playerId]) {
      const player = room.players[opts.playerId];
      player.lastSeenAt = now;
      const team = room.teams.find((t) => t.id === player.teamId);
      if (team) return { player, team };
    }

    for (const existing of Object.values(room.players)) {
      if (
        existing.name.toLowerCase() === name.toLowerCase() &&
        (opts.mode === "joinTeam" ? existing.teamId === opts.teamId : true)
      ) {
        const team = room.teams.find((t) => t.id === existing.teamId);
        if (team) {
          existing.lastSeenAt = now;
          return { player: existing, team };
        }
      }
    }

    let team: Team | undefined;

    if (opts.mode === "solo") {
      if (room.teams.length >= room.expectedTeams) {
        throw new Error(`Lobby is full (${room.expectedTeams} teams max)`);
      }
      team = { id: randomUUID(), name, isSolo: true, score: 0 };
      room.teams.push(team);
    } else if (opts.mode === "createTeam") {
      const teamName = (opts.teamName || name).trim().slice(0, 28) || "Team";
      const existingTeam = room.teams.find(
        (t) => t.name.toLowerCase() === teamName.toLowerCase(),
      );
      if (existingTeam) {
        team = existingTeam;
      } else {
        if (room.teams.length >= room.expectedTeams) {
          throw new Error(`Lobby is full (${room.expectedTeams} teams max)`);
        }
        team = { id: randomUUID(), name: teamName, isSolo: false, score: 0 };
        room.teams.push(team);
      }
    } else {
      team = room.teams.find((t) => t.id === opts.teamId);
      if (!team) throw new Error("Team not found");
    }

    const player: Player = {
      id: randomUUID(),
      name,
      teamId: team.id,
      lastSeenAt: now,
    };
    room.players[player.id] = player;
    return { player, team };
  }

  kickTeam(room: GameRoom, teamId: string) {
    room.teams = room.teams.filter((t) => t.id !== teamId);
    delete room.currentAnswers[teamId];
    for (const [id, player] of Object.entries(room.players)) {
      if (player.teamId === teamId) delete room.players[id];
    }
  }

  adjustScore(room: GameRoom, teamId: string, delta: number) {
    const team = room.teams.find((t) => t.id === teamId);
    if (!team) throw new Error("Team not found");
    const step = delta > 0 ? 1 : delta < 0 ? -1 : 0;
    if (!step) throw new Error("Invalid score change");
    team.score = Math.max(0, team.score + step);
  }

  setQuestions(room: GameRoom, questions: Question[], timeLimitSec?: number) {
    if (room.phase === "finished") {
      throw new Error("Can't edit questions after the night ends");
    }
    if (!questions.length) throw new Error("Need at least one question");
    if (room.questionIndex >= 0 && questions.length <= room.questionIndex) {
      throw new Error("Can't remove questions that already ran");
    }

    if (typeof timeLimitSec === "number" && Number.isFinite(timeLimitSec)) {
      room.timeLimitSec = Math.max(5, Math.min(180, Math.floor(timeLimitSec)));
    }

    room.questions = questions.map((q) => ({
      ...q,
      timeLimitSec: room.timeLimitSec,
    }));
  }

  startQuestion(room: GameRoom) {
    return startQuestionOnRoom(room);
  }

  pauseTimer(room: GameRoom) {
    if (room.phase !== "question") throw new Error("No active question");
    if (room.timerPausedRemainingMs != null) {
      throw new Error("Timer is already paused");
    }
    if (!room.timerEndsAt) throw new Error("No timer running");
    room.timerPausedRemainingMs = Math.max(0, room.timerEndsAt - Date.now());
    room.timerEndsAt = null;
  }

  resumeTimer(room: GameRoom) {
    if (room.phase !== "question") throw new Error("No active question");
    if (room.timerPausedRemainingMs == null) {
      throw new Error("Timer is not paused");
    }
    armQuestionTimer(room, Math.max(500, room.timerPausedRemainingMs));
  }

  restartTimer(room: GameRoom) {
    if (room.phase !== "question") throw new Error("No active question");
    armQuestionTimer(room, Math.max(5, room.timeLimitSec) * 1000);
  }

  forceLock(room: GameRoom) {
    if (room.phase === "question") {
      lockAnswers(room);
      return;
    }
    if (room.phase === "locked") {
      revealAnswers(room);
    }
  }

  finishGame(room: GameRoom) {
    room.phase = "finished";
    room.timerEndsAt = null;
    room.timerPausedRemainingMs = null;
    room.lockedAt = null;
  }

  submitAnswer(room: GameRoom, teamId: string, optionIndex: number) {
    if (room.phase !== "question") throw new Error("Answers are locked");
    if (
      room.timerPausedRemainingMs == null &&
      room.timerEndsAt &&
      Date.now() > room.timerEndsAt
    ) {
      throw new Error("Time is up");
    }
    if (optionIndex < 0 || optionIndex > 3) throw new Error("Invalid answer");
    room.currentAnswers[teamId] = optionIndex;
  }
}

export const gameStore = new GameStore();

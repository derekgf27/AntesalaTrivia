import { randomUUID } from "crypto";
import { SAMPLE_QUESTIONS } from "./sampleQuestions";
import { titleFromScheduledDate, toDateInputValue } from "./dateUtils";
import {
  findNightByCode,
  findOpenNight,
  upsertNight,
} from "./nightHistory";
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
  /** When set, the question timer is paused with this much time left. */
  timerPausedRemainingMs: number | null;
  /** Shared countdown for every question. */
  timeLimitSec: number;
  teams: Team[];
  players: Map<string, Player>;
  /** teamId -> option index for current question */
  currentAnswers: Map<string, number>;
  reveal: RevealInfo | null;
  timerHandle: ReturnType<typeof setTimeout> | null;
  adminSocketId: string | null;
  displaySocketIds: Set<string>;
};

class GameStore {
  private rooms = new Map<string, GameRoom>();
  private currentCode: string | null = null;

  getCurrentRoom(): GameRoom | undefined {
    if (!this.currentCode) return undefined;
    return this.rooms.get(this.currentCode);
  }

  createRoom(
    input: CreateNightInput = {
      scheduledDate: toDateInputValue(),
      expectedTeams: 64,
    },
  ): GameRoom {
    let code = generateCode();
    while (this.rooms.has(code)) code = generateCode();

    const rawDate = input.scheduledDate?.trim() || "";
    const scheduledDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : toDateInputValue();
    const title = titleFromScheduledDate(scheduledDate);
    const expectedTeams = Math.max(
      1,
      Math.min(64, Math.floor(input.expectedTeams) || 64),
    );

    const room: GameRoom = {
      id: randomUUID(),
      code,
      title,
      scheduledDate,
      expectedTeams,
      createdAt: new Date().toISOString(),
      phase: "lobby",
      questions:
        input.questions && input.questions.length > 0
          ? input.questions
          : SAMPLE_QUESTIONS.map((q) => ({ ...q, id: randomUUID() })),
      questionIndex: -1,
      timerEndsAt: null,
      timerPausedRemainingMs: null,
      timeLimitSec: 30,
      teams: [],
      players: new Map(),
      currentAnswers: new Map(),
      reveal: null,
      timerHandle: null,
      adminSocketId: null,
      displaySocketIds: new Set(),
    };

    this.rooms.set(code, room);
    this.currentCode = code;
    this.persistRoom(room);
    return room;
  }

  getRoom(code: string): GameRoom | undefined {
    return this.rooms.get(code.toUpperCase().trim());
  }

  /** Bring back the latest unfinished night after a server restart. */
  hydrateOpenNight(): GameRoom | undefined {
    const live = this.getCurrentRoom();
    if (live) return live;
    const open = findOpenNight();
    if (!open) return undefined;
    return this.restoreRoom(open);
  }

  getRoomOrRestore(code: string): GameRoom | undefined {
    const live = this.getRoom(code);
    if (live) return live;
    const record = findNightByCode(code);
    if (!record) return undefined;
    if (record.finishedAt || record.phase === "finished") {
      return undefined;
    }
    return this.restoreRoom(record);
  }

  restoreRoom(record: NightRecord): GameRoom {
    const code = record.code.toUpperCase().trim();
    const existing = this.rooms.get(code);
    if (existing) {
      this.currentCode = existing.code;
      return existing;
    }

    const hasQuestions = Boolean(record.questions?.length);
    const questions = hasQuestions
      ? record.questions!.map((q) => ({ ...q }))
      : SAMPLE_QUESTIONS.map((q) => ({ ...q, id: randomUUID() }));

    let phase = (record.phase as GamePhase) || "lobby";
    let questionIndex =
      typeof record.questionIndex === "number" ? record.questionIndex : -1;

    // In-flight timers cannot survive a restart.
    if (phase === "question" || phase === "locked") {
      phase = questionIndex >= 0 ? "reveal" : "lobby";
    }
    // Older saves lacked the question bank — safest to reopen in lobby.
    if (!hasQuestions && phase !== "finished") {
      phase = "lobby";
      questionIndex = -1;
    }
    if (phase === "lobby") questionIndex = -1;

    const room: GameRoom = {
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
          record.timeLimitSec ||
            record.questions?.[0]?.timeLimitSec ||
            30,
        ),
      ),
      teams: (record.teams || []).map((t) => ({ ...t })),
      players: new Map(),
      currentAnswers: new Map(),
      reveal:
        phase === "reveal" || phase === "finished"
          ? record.reveal ?? null
          : null,
      timerHandle: null,
      adminSocketId: null,
      displaySocketIds: new Set(),
    };

    this.rooms.set(code, room);
    if (phase !== "finished") this.currentCode = code;
    this.persistRoom(room);
    return room;
  }

  deleteRoom(code: string) {
    const room = this.getRoom(code);
    if (!room) return;
    if (room.timerHandle) clearTimeout(room.timerHandle);
    this.rooms.delete(room.code);
    if (this.currentCode === room.code) this.currentCode = null;
  }

  toNightRecord(room: GameRoom): NightRecord {
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

  persistRoom(room: GameRoom) {
    upsertNight(this.toNightRecord(room));
  }

  toPublic(room: GameRoom): PublicGameState {
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
      answeredTeamIds: [...room.currentAnswers.keys()],
    };
  }

  toAdmin(room: GameRoom): AdminGameState {
    const connectedTeamIds = [
      ...new Set(
        [...room.players.values()]
          .filter((p) => Boolean(p.socketId))
          .map((p) => p.teamId),
      ),
    ];
    return {
      ...this.toPublic(room),
      id: room.id,
      questions: room.questions,
      currentAnswers: Object.fromEntries(room.currentAnswers),
      createdAt: room.createdAt,
      reveal: room.reveal,
      connectedTeamIds,
    };
  }

  addPlayer(
    room: GameRoom,
    opts: {
      socketId: string;
      playerName: string;
      mode: "solo" | "createTeam" | "joinTeam";
      teamName?: string;
      teamId?: string;
    },
  ): { player: Player; team: Team } {
    const name = opts.playerName.trim().slice(0, 24) || "Player";

    for (const existing of room.players.values()) {
      if (
        existing.name.toLowerCase() === name.toLowerCase() &&
        (opts.mode === "joinTeam" ? existing.teamId === opts.teamId : true)
      ) {
        const team = room.teams.find((t) => t.id === existing.teamId);
        if (team) {
          existing.socketId = opts.socketId;
          return { player: existing, team };
        }
      }
    }

    let team: Team | undefined;

    if (opts.mode === "solo") {
      if (room.teams.length >= room.expectedTeams) {
        throw new Error(`Lobby is full (${room.expectedTeams} teams max)`);
      }
      team = {
        id: randomUUID(),
        name: name,
        isSolo: true,
        score: 0,
      };
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
        team = {
          id: randomUUID(),
          name: teamName,
          isSolo: false,
          score: 0,
        };
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
      socketId: opts.socketId,
    };
    room.players.set(player.id, player);
    this.persistRoom(room);
    return { player, team };
  }

  removePlayerBySocket(socketId: string): GameRoom | null {
    for (const room of this.rooms.values()) {
      for (const player of room.players.values()) {
        if (player.socketId === socketId) {
          player.socketId = "";
          return room;
        }
      }
      if (room.adminSocketId === socketId) {
        room.adminSocketId = null;
        return room;
      }
      if (room.displaySocketIds.has(socketId)) {
        room.displaySocketIds.delete(socketId);
        return room;
      }
    }
    return null;
  }

  kickTeam(room: GameRoom, teamId: string) {
    room.teams = room.teams.filter((t) => t.id !== teamId);
    room.currentAnswers.delete(teamId);
    for (const [id, player] of room.players) {
      if (player.teamId === teamId) room.players.delete(id);
    }
    this.persistRoom(room);
  }

  adjustScore(room: GameRoom, teamId: string, delta: number) {
    const team = room.teams.find((t) => t.id === teamId);
    if (!team) throw new Error("Team not found");
    const step = delta > 0 ? 1 : delta < 0 ? -1 : 0;
    if (!step) throw new Error("Invalid score change");
    team.score = Math.max(0, team.score + step);
    this.persistRoom(room);
  }

  setQuestions(
    room: GameRoom,
    questions: Question[],
    timeLimitSec?: number,
  ) {
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
    this.persistRoom(room);
  }

  startQuestion(
    room: GameRoom,
    onUpdate: (room: GameRoom) => void,
  ): "started" | "finished" {
    if (room.phase === "finished") throw new Error("Game already finished");
    if (room.phase === "question" || room.phase === "locked") {
      throw new Error("Question already in progress");
    }

    const nextIndex = room.questionIndex + 1;
    if (nextIndex >= room.questions.length) {
      room.phase = "finished";
      room.timerEndsAt = null;
      room.timerPausedRemainingMs = null;
      this.persistRoom(room);
      return "finished";
    }

    if (room.timerHandle) clearTimeout(room.timerHandle);

    room.questionIndex = nextIndex;
    room.phase = "question";
    room.currentAnswers = new Map();
    room.reveal = null;
    room.timerPausedRemainingMs = null;

    const ms = Math.max(5, room.timeLimitSec) * 1000;
    this.armQuestionTimer(room, ms, onUpdate);

    return "started";
  }

  /** Schedule lock → reveal from a remaining duration. */
  private armQuestionTimer(
    room: GameRoom,
    ms: number,
    onUpdate: (room: GameRoom) => void,
  ) {
    if (room.timerHandle) clearTimeout(room.timerHandle);
    room.timerPausedRemainingMs = null;
    room.timerEndsAt = Date.now() + ms;
    room.timerHandle = setTimeout(() => {
      this.lockAnswers(room);
      onUpdate(room);
      room.timerHandle = setTimeout(() => {
        this.revealAnswers(room);
        onUpdate(room);
      }, 2500);
    }, ms);
  }

  pauseTimer(room: GameRoom) {
    if (room.phase !== "question") throw new Error("No active question");
    if (room.timerPausedRemainingMs != null) {
      throw new Error("Timer is already paused");
    }
    if (!room.timerEndsAt) throw new Error("No timer running");

    const remaining = Math.max(0, room.timerEndsAt - Date.now());
    if (room.timerHandle) {
      clearTimeout(room.timerHandle);
      room.timerHandle = null;
    }
    room.timerPausedRemainingMs = remaining;
    room.timerEndsAt = null;
  }

  resumeTimer(room: GameRoom, onUpdate: (room: GameRoom) => void) {
    if (room.phase !== "question") throw new Error("No active question");
    if (room.timerPausedRemainingMs == null) {
      throw new Error("Timer is not paused");
    }
    const ms = Math.max(500, room.timerPausedRemainingMs);
    this.armQuestionTimer(room, ms, onUpdate);
  }

  /** Reset the clock to the full question time limit. */
  restartTimer(room: GameRoom, onUpdate: (room: GameRoom) => void) {
    if (room.phase !== "question") throw new Error("No active question");
    const ms = Math.max(5, room.timeLimitSec) * 1000;
    this.armQuestionTimer(room, ms, onUpdate);
  }

  /** Freeze answers — brief beat before showing the correct answer. */
  lockAnswers(room: GameRoom) {
    if (room.phase !== "question") return;
    if (room.timerHandle) {
      clearTimeout(room.timerHandle);
      room.timerHandle = null;
    }
    room.phase = "locked";
    room.timerEndsAt = null;
    room.timerPausedRemainingMs = null;
    room.reveal = null;
  }

  revealAnswers(room: GameRoom) {
    if (room.phase !== "locked" && room.phase !== "question") return;
    if (room.timerHandle) {
      clearTimeout(room.timerHandle);
      room.timerHandle = null;
    }

    const q = room.questions[room.questionIndex];
    const awarded: RevealInfo["awarded"] = [];

    for (const [teamId, answer] of room.currentAnswers) {
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
    this.persistRoom(room);
  }

  forceLock(room: GameRoom, onUpdate: (room: GameRoom) => void) {
    if (room.phase === "question") {
      this.lockAnswers(room);
      onUpdate(room);
      room.timerHandle = setTimeout(() => {
        this.revealAnswers(room);
        onUpdate(room);
      }, 2500);
      return;
    }
    if (room.phase === "locked") {
      this.revealAnswers(room);
      onUpdate(room);
    }
  }

  finishGame(room: GameRoom) {
    if (room.timerHandle) {
      clearTimeout(room.timerHandle);
      room.timerHandle = null;
    }
    room.phase = "finished";
    room.timerEndsAt = null;
    room.timerPausedRemainingMs = null;
    this.persistRoom(room);
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
    room.currentAnswers.set(teamId, optionIndex);
  }
}

export const gameStore = new GameStore();

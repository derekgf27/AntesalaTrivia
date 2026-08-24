import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { gameStore } from "./src/lib/game/store";
import {
  authenticateHost,
  requireHostToken,
} from "./src/lib/game/hostAuth";
import { searchNights } from "./src/lib/game/nightHistory";
import { SOCKET_EVENTS } from "./src/lib/socket/events";
import type {
  AdminJoinPayload,
  AdjustScorePayload,
  CreateGamePayload,
  DisplayJoinPayload,
  HostAuthPayload,
  KickTeamPayload,
  ListNightsPayload,
  PeekLobbyPayload,
  PlayerJoinPayload,
  SetQuestionsPayload,
  SubmitAnswerPayload,
} from "./src/lib/socket/events";
import type { GameRoom } from "./src/lib/game/store";

const lifecycle = process.env.npm_lifecycle_event;
const dev =
  lifecycle === "dev" ||
  process.env.NODE_ENV === "development" ||
  !lifecycle;
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

type SocketData = {
  role?: "admin" | "display" | "player";
  code?: string;
  playerId?: string;
  teamId?: string;
  hostToken?: string;
};

function roomChannel(code: string) {
  return `game:${code}`;
}

function broadcast(io: Server, room: GameRoom) {
  const publicState = gameStore.toPublic(room);
  io.to(roomChannel(room.code)).emit(SOCKET_EVENTS.STATE, publicState);
  if (room.adminSocketId) {
    io.to(room.adminSocketId).emit(
      SOCKET_EVENTS.ADMIN_STATE,
      gameStore.toAdmin(room),
    );
  }
}

function requireActiveAdmin(socket: { id: string; data: SocketData }): GameRoom {
  const data = socket.data;
  if (data.role !== "admin" || !data.code) throw new Error("Admin only");
  if (!data.hostToken) throw new Error("Host session expired — enter the PIN again");
  requireHostToken(data.hostToken);
  const room = gameStore.getRoom(data.code);
  if (!room) throw new Error("Game not found");
  if (room.adminSocketId !== socket.id) throw new Error("Not the active admin");
  return room;
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    const data = socket.data as SocketData;

    socket.on(SOCKET_EVENTS.HOST_AUTH, (payload: HostAuthPayload, ack?: (r: unknown) => void) => {
      try {
        const hostToken = authenticateHost(payload?.pin);
        data.hostToken = hostToken;
        ack?.({ ok: true, hostToken });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Wrong admin PIN";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.CREATE_GAME, (payload: CreateGamePayload, ack?: (r: unknown) => void) => {
      try {
        requireHostToken(payload?.hostToken);
        const room = gameStore.createRoom({
          scheduledDate: payload?.scheduledDate,
          expectedTeams: payload?.expectedTeams ?? 64,
          questions: payload?.questions,
        });
        room.adminSocketId = socket.id;
        data.role = "admin";
        data.code = room.code;
        data.hostToken = payload.hostToken;
        socket.join(roomChannel(room.code));
        const adminState = gameStore.toAdmin(room);
        ack?.({ ok: true, state: adminState });
        socket.emit(SOCKET_EVENTS.ADMIN_STATE, adminState);
        socket.emit(SOCKET_EVENTS.STATE, gameStore.toPublic(room));
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to create game";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.ADMIN_JOIN, (payload: AdminJoinPayload, ack?: (r: unknown) => void) => {
      try {
        requireHostToken(payload?.hostToken);
        const room = payload.code
          ? gameStore.getRoomOrRestore(payload.code)
          : gameStore.hydrateOpenNight();
        if (!room) throw new Error("No trivia night is running — start a new one");
        room.adminSocketId = socket.id;
        data.role = "admin";
        data.code = room.code;
        data.hostToken = payload.hostToken;
        socket.join(roomChannel(room.code));
        const adminState = gameStore.toAdmin(room);
        ack?.({ ok: true, state: adminState });
        socket.emit(SOCKET_EVENTS.ADMIN_STATE, adminState);
        broadcast(io, room);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to join as admin";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.LIST_NIGHTS, (payload: ListNightsPayload, ack?: (r: unknown) => void) => {
      try {
        requireHostToken(payload?.hostToken);
        const current = gameStore.hydrateOpenNight();
        const nights = searchNights(payload?.query || "");
        ack?.({
          ok: true,
          nights,
          hasCurrent: Boolean(current),
          currentCode: current?.code ?? null,
          currentTitle: current?.title ?? null,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not list nights";
        ack?.({ ok: false, error: message });
      }
    });

    socket.on(SOCKET_EVENTS.DISPLAY_JOIN, (payload: DisplayJoinPayload, ack?: (r: unknown) => void) => {
      try {
        const room = gameStore.getRoomOrRestore(payload.code);
        if (!room) throw new Error("Game not found");
        room.displaySocketIds.add(socket.id);
        data.role = "display";
        data.code = room.code;
        socket.join(roomChannel(room.code));
        const state = gameStore.toPublic(room);
        ack?.({ ok: true, state });
        socket.emit(SOCKET_EVENTS.STATE, state);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to open display";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.PEEK_LOBBY, (payload: PeekLobbyPayload, ack?: (r: unknown) => void) => {
      try {
        const room = gameStore.getRoomOrRestore(payload.code);
        if (!room) throw new Error("Game not found");
        if (room.phase === "finished") throw new Error("This night is over");
        const publicState = gameStore.toPublic(room);
        ack?.({
          ok: true,
          code: publicState.code,
          title: publicState.title,
          phase: publicState.phase,
          teams: publicState.teams.filter((t) => !t.isSolo),
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not load lobby";
        ack?.({ ok: false, error: message });
      }
    });

    socket.on(SOCKET_EVENTS.PLAYER_JOIN, (payload: PlayerJoinPayload, ack?: (r: unknown) => void) => {
      try {
        const room = gameStore.getRoomOrRestore(payload.code);
        if (!room) throw new Error("Game not found");
        if (room.phase === "finished") throw new Error("This night is over");

        const { player, team } = gameStore.addPlayer(room, {
          socketId: socket.id,
          playerName: payload.playerName,
          mode: payload.mode,
          teamName: payload.teamName,
          teamId: payload.teamId,
        });

        data.role = "player";
        data.code = room.code;
        data.playerId = player.id;
        data.teamId = team.id;
        socket.join(roomChannel(room.code));

        const state = gameStore.toPublic(room);
        ack?.({ ok: true, state, playerId: player.id, teamId: team.id, teamName: team.name });
        socket.emit(SOCKET_EVENTS.JOINED, {
          playerId: player.id,
          teamId: team.id,
          teamName: team.name,
        });
        broadcast(io, room);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to join";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.START_QUESTION, (_payload?: unknown, ack?: (r: unknown) => void) => {
      try {
        const room = requireActiveAdmin(socket);
        const result = gameStore.startQuestion(room, (lockedRoom) => {
          broadcast(io, lockedRoom);
        });
        broadcast(io, room);
        ack?.({ ok: true, result });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not start question";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.FORCE_LOCK, (_payload?: unknown, ack?: (r: unknown) => void) => {
      try {
        const room = requireActiveAdmin(socket);
        gameStore.forceLock(room, (updated) => {
          broadcast(io, updated);
        });
        broadcast(io, room);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not lock";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.PAUSE_TIMER, (_payload?: unknown, ack?: (r: unknown) => void) => {
      try {
        const room = requireActiveAdmin(socket);
        gameStore.pauseTimer(room);
        broadcast(io, room);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not pause timer";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.RESUME_TIMER, (_payload?: unknown, ack?: (r: unknown) => void) => {
      try {
        const room = requireActiveAdmin(socket);
        gameStore.resumeTimer(room, (updated) => {
          broadcast(io, updated);
        });
        broadcast(io, room);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not resume timer";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.RESTART_TIMER, (_payload?: unknown, ack?: (r: unknown) => void) => {
      try {
        const room = requireActiveAdmin(socket);
        gameStore.restartTimer(room, (updated) => {
          broadcast(io, updated);
        });
        broadcast(io, room);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not restart timer";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.NEXT, (_payload?: unknown, ack?: (r: unknown) => void) => {
      try {
        const room = requireActiveAdmin(socket);
        if (room.phase === "question") throw new Error("Lock the question first");
        if (room.phase === "locked") {
          throw new Error("Wait for the reveal");
        }

        if (room.questionIndex + 1 >= room.questions.length) {
          gameStore.finishGame(room);
          broadcast(io, room);
          ack?.({ ok: true, result: "finished" });
          return;
        }

        const result = gameStore.startQuestion(room, (updated) => {
          broadcast(io, updated);
        });
        broadcast(io, room);
        ack?.({ ok: true, result });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not advance";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.SUBMIT_ANSWER, (payload: SubmitAnswerPayload, ack?: (r: unknown) => void) => {
      try {
        if (data.role !== "player" || !data.code || !data.teamId) {
          throw new Error("Join a team first");
        }
        const room = gameStore.getRoom(data.code);
        if (!room) throw new Error("Game not found");
        gameStore.submitAnswer(room, data.teamId, payload.optionIndex);
        broadcast(io, room);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not submit";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.KICK_TEAM, (payload: KickTeamPayload, ack?: (r: unknown) => void) => {
      try {
        const room = requireActiveAdmin(socket);
        gameStore.kickTeam(room, payload.teamId);
        broadcast(io, room);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not kick";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.ADJUST_SCORE, (payload: AdjustScorePayload, ack?: (r: unknown) => void) => {
      try {
        const room = requireActiveAdmin(socket);
        gameStore.adjustScore(room, payload.teamId, payload.delta);
        broadcast(io, room);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not adjust score";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.SET_QUESTIONS, (payload: SetQuestionsPayload, ack?: (r: unknown) => void) => {
      try {
        const room = requireActiveAdmin(socket);
        gameStore.setQuestions(room, payload.questions, payload.timeLimitSec);
        broadcast(io, room);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not update questions";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on(SOCKET_EVENTS.END_GAME, (_payload?: unknown, ack?: (r: unknown) => void) => {
      try {
        const room = requireActiveAdmin(socket);
        gameStore.finishGame(room);
        broadcast(io, room);
        ack?.({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not end game";
        ack?.({ ok: false, error: message });
        socket.emit(SOCKET_EVENTS.ERROR, { message });
      }
    });

    socket.on("disconnect", () => {
      const room = gameStore.removePlayerBySocket(socket.id);
      if (room) broadcast(io, room);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Antesala Trivia ready on http://${hostname}:${port}`);
  });
});

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "@/lib/socket/events";
import type {
  AdminGameState,
  CreateNightInput,
  NightRecord,
  PublicGameState,
  Question,
  Team,
} from "@/lib/game/types";
import {
  getHostToken,
  getRememberedAdminCode,
  getRememberedDisplayCode,
  isHostUnlocked,
  PLAYER_SESSION_KEY,
  rememberAdminCode,
  rememberDisplayCode,
  unlockHostSession,
} from "@/lib/hostSession";

type PlayerSession = {
  playerId: string;
  teamId: string;
  teamName: string;
};

type StoredPlayer = {
  code: string;
  playerName: string;
  playerId?: string;
  teamId: string;
  teamName: string;
  mode: "solo" | "createTeam" | "joinTeam";
};

type ListNightsResult = {
  nights: NightRecord[];
  hasCurrent: boolean;
  currentCode: string | null;
  currentTitle: string | null;
};

type PeekLobbyResult = {
  code: string;
  title: string;
  phase: string;
  teams: Team[];
};

type GameContextValue = {
  connected: boolean;
  state: PublicGameState | null;
  adminState: AdminGameState | null;
  player: PlayerSession | null;
  error: string | null;
  setError: (message: string | null) => void;
  setPlayer: (player: PlayerSession | null) => void;
  hostAuth: (pin: string) => Promise<string>;
  adminJoin: (code?: string) => Promise<AdminGameState>;
  createGame: (input: CreateNightInput) => Promise<AdminGameState>;
  listNights: (query?: string) => Promise<ListNightsResult>;
  displayJoin: (code: string) => Promise<PublicGameState>;
  peekLobby: (code: string) => Promise<PeekLobbyResult>;
  playerJoin: (payload: {
    code: string;
    playerName: string;
    mode: "solo" | "createTeam" | "joinTeam";
    teamName?: string;
    teamId?: string;
  }) => Promise<PlayerSession & { state: PublicGameState }>;
  startQuestion: () => Promise<unknown>;
  forceLock: () => Promise<unknown>;
  pauseTimer: () => Promise<unknown>;
  resumeTimer: () => Promise<unknown>;
  restartTimer: () => Promise<unknown>;
  nextQuestion: () => Promise<unknown>;
  submitAnswer: (optionIndex: number) => Promise<unknown>;
  kickTeam: (teamId: string) => Promise<unknown>;
  adjustScore: (teamId: string, delta: number) => Promise<unknown>;
  setQuestions: (questions: Question[], timeLimitSec?: number) => Promise<unknown>;
  endGame: () => Promise<unknown>;
};

const GameContext = createContext<GameContextValue | null>(null);

let sharedSocket: Socket | null = null;

function getSocket() {
  if (typeof window === "undefined") return null;
  if (!sharedSocket) {
    sharedSocket = io({
      autoConnect: true,
      transports: ["websocket", "polling"],
    });
  }
  return sharedSocket;
}

function readStoredPlayer(): StoredPlayer | null {
  try {
    const raw = sessionStorage.getItem(PLAYER_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPlayer;
  } catch {
    return null;
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<PublicGameState | null>(null);
  const [adminState, setAdminState] = useState<AdminGameState | null>(null);
  const [player, setPlayer] = useState<PlayerSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = getSocket();
    setSocket(s);
    if (!s) return;

    const restoreSessions = () => {
      if (isHostUnlocked()) {
        const token = getHostToken();
        const code = getRememberedAdminCode();
        if (token) {
          s.timeout(8000).emit(
            SOCKET_EVENTS.ADMIN_JOIN,
            { hostToken: token, code: code || undefined },
            (
              err: Error | null,
              res: { ok?: boolean; state?: AdminGameState; error?: string },
            ) => {
              if (err || !res || res.ok === false || !res.state) return;
              setAdminState(res.state);
              setState(res.state);
              setError(null);
            },
          );
        }
      }

      // Prefer one role per browser tab: host > display > player.
      if (isHostUnlocked()) return;

      const displayCode = getRememberedDisplayCode();
      if (displayCode) {
        s.timeout(8000).emit(
          SOCKET_EVENTS.DISPLAY_JOIN,
          { code: displayCode },
          (
            err: Error | null,
            res: { ok?: boolean; state?: PublicGameState; error?: string },
          ) => {
            if (err || !res || res.ok === false || !res.state) return;
            setState(res.state);
            rememberDisplayCode(res.state.code);
          },
        );
        return;
      }

      const stored = readStoredPlayer();
      if (stored) {
        s.timeout(8000).emit(
          SOCKET_EVENTS.PLAYER_JOIN,
          {
            code: stored.code,
            playerName: stored.playerName,
            mode: "joinTeam",
            teamId: stored.teamId,
            teamName: stored.teamName,
          },
          (
            err: Error | null,
            res: {
              ok?: boolean;
              state?: PublicGameState;
              playerId?: string;
              teamId?: string;
              teamName?: string;
              error?: string;
            },
          ) => {
            if (err || !res || res.ok === false || !res.state || !res.playerId) {
              return;
            }
            const session = {
              playerId: res.playerId,
              teamId: res.teamId!,
              teamName: res.teamName!,
            };
            setPlayer(session);
            setState(res.state);
            sessionStorage.setItem(
              PLAYER_SESSION_KEY,
              JSON.stringify({
                ...stored,
                playerId: session.playerId,
                teamId: session.teamId,
                teamName: session.teamName,
              }),
            );
          },
        );
      }
    };

    const onConnect = () => {
      setConnected(true);
      restoreSessions();
    };
    const onDisconnect = () => setConnected(false);
    const onState = (payload: PublicGameState) => setState(payload);
    const onAdmin = (payload: AdminGameState) => {
      setAdminState(payload);
      setState(payload);
      rememberAdminCode(payload.code);
    };
    const onError = (payload: { message: string }) => {
      if (
        payload.message === "Admin only" ||
        payload.message === "Not the active admin"
      ) {
        restoreSessions();
        setError("Reconnecting host controls…");
        return;
      }
      setError(payload.message);
    };
    const onJoined = (payload: PlayerSession) => setPlayer(payload);

    setConnected(s.connected);
    if (s.connected) restoreSessions();
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on(SOCKET_EVENTS.STATE, onState);
    s.on(SOCKET_EVENTS.ADMIN_STATE, onAdmin);
    s.on(SOCKET_EVENTS.ERROR, onError);
    s.on(SOCKET_EVENTS.JOINED, onJoined);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off(SOCKET_EVENTS.STATE, onState);
      s.off(SOCKET_EVENTS.ADMIN_STATE, onAdmin);
      s.off(SOCKET_EVENTS.ERROR, onError);
      s.off(SOCKET_EVENTS.JOINED, onJoined);
    };
  }, []);

  const emitAck = useCallback(
    <T,>(event: string, payload?: unknown) =>
      new Promise<T>((resolve, reject) => {
        if (!socket) {
          reject(new Error("Not connected"));
          return;
        }
        setError(null);
        socket
          .timeout(8000)
          .emit(
            event,
            payload ?? {},
            (
              err: Error | null,
              res: T & { ok?: boolean; error?: string },
            ) => {
              if (err) {
                reject(err);
                return;
              }
              if (res && typeof res === "object" && res.ok === false) {
                const message = res.error || "Request failed";
                setError(message);
                reject(new Error(message));
                return;
              }
              resolve(res);
            },
          );
      }),
    [socket],
  );

  const withHostToken = useCallback(() => {
    const hostToken = getHostToken();
    if (!hostToken) throw new Error("Host session expired — enter the PIN again");
    return hostToken;
  }, []);

  const value = useMemo<GameContextValue>(
    () => ({
      connected,
      state,
      adminState,
      player,
      error,
      setError,
      setPlayer,
      hostAuth: (pin) =>
        emitAck<{ ok: true; hostToken: string }>(SOCKET_EVENTS.HOST_AUTH, {
          pin,
        }).then((res) => {
          unlockHostSession(res.hostToken);
          return res.hostToken;
        }),
      createGame: (input) =>
        emitAck<{ ok: true; state: AdminGameState }>(SOCKET_EVENTS.CREATE_GAME, {
          ...input,
          hostToken: withHostToken(),
        }).then((res) => {
          setAdminState(res.state);
          setState(res.state);
          rememberAdminCode(res.state.code);
          return res.state;
        }),
      adminJoin: (code) =>
        emitAck<{ ok: true; state: AdminGameState }>(SOCKET_EVENTS.ADMIN_JOIN, {
          hostToken: withHostToken(),
          code,
        }).then((res) => {
          setAdminState(res.state);
          setState(res.state);
          rememberAdminCode(res.state.code);
          return res.state;
        }),
      listNights: (query) =>
        emitAck<{
          ok: true;
          nights: NightRecord[];
          hasCurrent: boolean;
          currentCode: string | null;
          currentTitle: string | null;
        }>(SOCKET_EVENTS.LIST_NIGHTS, {
          hostToken: withHostToken(),
          query,
        }).then((res) => ({
          nights: res.nights,
          hasCurrent: res.hasCurrent,
          currentCode: res.currentCode,
          currentTitle: res.currentTitle,
        })),
      displayJoin: (code) =>
        emitAck<{ ok: true; state: PublicGameState }>(
          SOCKET_EVENTS.DISPLAY_JOIN,
          { code },
        ).then((res) => {
          setState(res.state);
          rememberDisplayCode(res.state.code);
          return res.state;
        }),
      peekLobby: (code) =>
        emitAck<{
          ok: true;
          code: string;
          title: string;
          phase: string;
          teams: Team[];
        }>(SOCKET_EVENTS.PEEK_LOBBY, { code }).then((res) => ({
          code: res.code,
          title: res.title,
          phase: res.phase,
          teams: res.teams,
        })),
      playerJoin: (payload) =>
        emitAck<{
          ok: true;
          state: PublicGameState;
          playerId: string;
          teamId: string;
          teamName: string;
        }>(SOCKET_EVENTS.PLAYER_JOIN, payload).then((res) => {
          const session = {
            playerId: res.playerId,
            teamId: res.teamId,
            teamName: res.teamName,
          };
          setState(res.state);
          setPlayer(session);
          return { ...session, state: res.state };
        }),
      startQuestion: () => emitAck(SOCKET_EVENTS.START_QUESTION),
      forceLock: () => emitAck(SOCKET_EVENTS.FORCE_LOCK),
      pauseTimer: () => emitAck(SOCKET_EVENTS.PAUSE_TIMER),
      resumeTimer: () => emitAck(SOCKET_EVENTS.RESUME_TIMER),
      restartTimer: () => emitAck(SOCKET_EVENTS.RESTART_TIMER),
      nextQuestion: () => emitAck(SOCKET_EVENTS.NEXT),
      submitAnswer: (optionIndex) =>
        emitAck(SOCKET_EVENTS.SUBMIT_ANSWER, { optionIndex }),
      kickTeam: (teamId) => emitAck(SOCKET_EVENTS.KICK_TEAM, { teamId }),
      adjustScore: (teamId, delta) =>
        emitAck(SOCKET_EVENTS.ADJUST_SCORE, { teamId, delta }),
      setQuestions: (questions, timeLimitSec) =>
        emitAck(SOCKET_EVENTS.SET_QUESTIONS, { questions, timeLimitSec }),
      endGame: () => emitAck(SOCKET_EVENTS.END_GAME),
    }),
    [connected, state, adminState, player, error, emitAck, withHostToken],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameState() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGameState must be used within GameProvider");
  return ctx;
}

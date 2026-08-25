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
  clearRememberedAdminCode,
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

type Watch = {
  code: string;
  view: "public" | "admin";
  playerId?: string;
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
  deleteNight: (nightId: string) => Promise<{
    deleted: NightRecord;
    wasCurrent: boolean;
  }>;
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

function readStoredPlayer(): StoredPlayer | null {
  try {
    const raw = sessionStorage.getItem(PLAYER_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPlayer;
  } catch {
    return null;
  }
}

async function postAction<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/game", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<PublicGameState | null>(null);
  const [adminState, setAdminState] = useState<AdminGameState | null>(null);
  const [player, setPlayer] = useState<PlayerSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watch, setWatch] = useState<Watch | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        const res = await fetch("/api/health");
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (cancelled) return;
        setConnected(res.ok);
        if (!res.ok && data.error) setError(data.error);
      } catch {
        if (!cancelled) setConnected(false);
      }
    };
    void ping();
    const id = window.setInterval(ping, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!watch) return;
    let cancelled = false;

    const pull = async () => {
      try {
        const params = new URLSearchParams({
          code: watch.code,
          view: watch.view,
        });
        if (watch.view === "admin") {
          const token = getHostToken();
          if (token) params.set("hostToken", token);
        }
        if (watch.playerId) params.set("playerId", watch.playerId);
        const res = await fetch(`/api/game?${params.toString()}`);
        const data = (await res.json()) as {
          ok?: boolean;
          state?: PublicGameState;
          adminState?: AdminGameState;
        };
        if (cancelled || !res.ok || !data.ok) return;
        if (data.adminState) {
          setAdminState(data.adminState);
          setState(data.adminState);
          rememberAdminCode(data.adminState.code);
        } else if (data.state) {
          setState(data.state);
        }
      } catch {
        /* next poll retries */
      }
    };

    void pull();
    const id = window.setInterval(pull, 800);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [watch]);

  useEffect(() => {
    if (!connected) return;

    if (isHostUnlocked()) {
      const token = getHostToken();
      const code = getRememberedAdminCode();
      if (!token) return;
      void postAction<{ adminState?: AdminGameState }>({
        action: "adminJoin",
        hostToken: token,
        code: code || undefined,
      })
        .then((res) => {
          if (!res.adminState) return;
          setAdminState(res.adminState);
          setState(res.adminState);
          rememberAdminCode(res.adminState.code);
          setWatch({ code: res.adminState.code, view: "admin" });
        })
        .catch(() => undefined);
      return;
    }

    const displayCode = getRememberedDisplayCode();
    if (displayCode) {
      void postAction<{ state?: PublicGameState }>({
        action: "displayJoin",
        code: displayCode,
      })
        .then((res) => {
          if (!res.state) return;
          setState(res.state);
          rememberDisplayCode(res.state.code);
          setWatch({ code: res.state.code, view: "public" });
        })
        .catch(() => undefined);
      return;
    }

    const stored = readStoredPlayer();
    if (stored) {
      void postAction<{
        state?: PublicGameState;
        playerId?: string;
        teamId?: string;
        teamName?: string;
      }>({
        action: "playerJoin",
        code: stored.code,
        playerName: stored.playerName,
        mode: "joinTeam",
        teamId: stored.teamId,
        teamName: stored.teamName,
        playerId: stored.playerId,
      })
        .then((res) => {
          if (!res.state || !res.playerId) return;
          const session = {
            playerId: res.playerId,
            teamId: res.teamId!,
            teamName: res.teamName!,
          };
          setPlayer(session);
          setState(res.state);
          setWatch({
            code: res.state.code,
            view: "public",
            playerId: session.playerId,
          });
        })
        .catch(() => undefined);
    }
  }, [connected]);

  const withHostToken = useCallback(() => {
    const hostToken = getHostToken();
    if (!hostToken) throw new Error("Host session expired — enter the PIN again");
    return hostToken;
  }, []);

  const hostAction = useCallback(
    async <T,>(action: string, extra: Record<string, unknown> = {}) => {
      setError(null);
      const data = await postAction<
        T & { state?: PublicGameState; adminState?: AdminGameState }
      >({
        action,
        hostToken: withHostToken(),
        code: getRememberedAdminCode() || undefined,
        ...extra,
      });
      if (data.adminState) {
        setAdminState(data.adminState);
        setState(data.adminState);
        rememberAdminCode(data.adminState.code);
        setWatch({ code: data.adminState.code, view: "admin" });
      } else if (data.state) {
        setState(data.state);
      }
      return data;
    },
    [withHostToken],
  );

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
        postAction<{ hostToken: string }>({ action: "hostAuth", pin }).then(
          (res) => {
            unlockHostSession(res.hostToken);
            setError(null);
            return res.hostToken;
          },
        ),
      createGame: (input) =>
        hostAction<{ adminState: AdminGameState }>("createGame", {
          ...input,
        }).then((res) => {
          if (!res.adminState) throw new Error("Could not create night");
          return res.adminState;
        }),
      adminJoin: (code) =>
        hostAction<{ adminState: AdminGameState }>("adminJoin", { code }).then(
          (res) => {
            if (!res.adminState) {
              throw new Error("No trivia night is running — start a new one");
            }
            return res.adminState;
          },
        ),
      listNights: (query) =>
        postAction<{
          nights: NightRecord[];
          hasCurrent: boolean;
          currentCode: string | null;
          currentTitle: string | null;
        }>({
          action: "listNights",
          hostToken: withHostToken(),
          query,
        }).then((res) => ({
          nights: res.nights,
          hasCurrent: res.hasCurrent,
          currentCode: res.currentCode,
          currentTitle: res.currentTitle,
        })),
      deleteNight: (nightId) =>
        postAction<{
          deleted: NightRecord;
          wasCurrent: boolean;
        }>({
          action: "deleteNight",
          hostToken: withHostToken(),
          nightId,
        }).then((res) => {
          const deletedCode = res.deleted.code?.toUpperCase();
          if (
            res.wasCurrent ||
            (deletedCode && adminState?.code.toUpperCase() === deletedCode)
          ) {
            setAdminState(null);
            setState(null);
            setWatch(null);
            clearRememberedAdminCode();
          }
          return {
            deleted: res.deleted,
            wasCurrent: res.wasCurrent,
          };
        }),
      displayJoin: (code) =>
        postAction<{ state: PublicGameState }>({
          action: "displayJoin",
          code,
        }).then((res) => {
          setState(res.state);
          rememberDisplayCode(res.state.code);
          setWatch({ code: res.state.code, view: "public" });
          return res.state;
        }),
      peekLobby: (code) =>
        postAction<{
          code: string;
          title: string;
          phase: string;
          teams: Team[];
        }>({ action: "peekLobby", code }).then((res) => ({
          code: res.code,
          title: res.title,
          phase: res.phase,
          teams: res.teams,
        })),
      playerJoin: (payload) =>
        postAction<{
          state: PublicGameState;
          playerId: string;
          teamId: string;
          teamName: string;
        }>({
          action: "playerJoin",
          ...payload,
          playerId: readStoredPlayer()?.playerId,
        }).then((res) => {
          const session = {
            playerId: res.playerId,
            teamId: res.teamId,
            teamName: res.teamName,
          };
          setState(res.state);
          setPlayer(session);
          setWatch({
            code: res.state.code,
            view: "public",
            playerId: session.playerId,
          });
          return { ...session, state: res.state };
        }),
      startQuestion: () => hostAction("startQuestion"),
      forceLock: () => hostAction("forceLock"),
      pauseTimer: () => hostAction("pauseTimer"),
      resumeTimer: () => hostAction("resumeTimer"),
      restartTimer: () => hostAction("restartTimer"),
      nextQuestion: () => hostAction("nextQuestion"),
      submitAnswer: (optionIndex) => {
        const stored = readStoredPlayer();
        const code = stored?.code || state?.code;
        const playerId = player?.playerId || stored?.playerId;
        if (!code || !playerId) {
          return Promise.reject(new Error("Join a team first"));
        }
        setError(null);
        return postAction<{ state?: PublicGameState }>({
          action: "submitAnswer",
          code,
          playerId,
          optionIndex,
        }).then((res) => {
          if (res.state) setState(res.state);
          return res;
        });
      },
      kickTeam: (teamId) => hostAction("kickTeam", { teamId }),
      adjustScore: (teamId, delta) => hostAction("adjustScore", { teamId, delta }),
      setQuestions: (questions, timeLimitSec) =>
        hostAction("setQuestions", { questions, timeLimitSec }),
      endGame: () => hostAction("endGame"),
    }),
    [
      connected,
      state,
      adminState,
      player,
      error,
      hostAction,
      withHostToken,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameState() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGameState must be used within GameProvider");
  return ctx;
}

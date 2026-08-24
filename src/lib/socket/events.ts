import type { CreateNightInput, Question } from "@/lib/game/types";

export const SOCKET_EVENTS = {
  HOST_AUTH: "game:hostAuth",
  CREATE_GAME: "game:create",
  ADMIN_JOIN: "game:adminJoin",
  DISPLAY_JOIN: "game:displayJoin",
  PEEK_LOBBY: "game:peekLobby",
  PLAYER_JOIN: "game:playerJoin",
  START_QUESTION: "game:startQuestion",
  FORCE_LOCK: "game:forceLock",
  PAUSE_TIMER: "game:pauseTimer",
  RESUME_TIMER: "game:resumeTimer",
  RESTART_TIMER: "game:restartTimer",
  NEXT: "game:next",
  SUBMIT_ANSWER: "game:submitAnswer",
  KICK_TEAM: "game:kickTeam",
  ADJUST_SCORE: "game:adjustScore",
  SET_QUESTIONS: "game:setQuestions",
  END_GAME: "game:endGame",
  LIST_NIGHTS: "game:listNights",
  STATE: "game:state",
  ADMIN_STATE: "game:adminState",
  ERROR: "game:error",
  JOINED: "game:joined",
} as const;

export type HostAuthPayload = {
  pin: string;
};

export type CreateGamePayload = CreateNightInput & {
  hostToken: string;
  questions?: Question[];
};

export type AdminJoinPayload = {
  hostToken: string;
  /** Optional — if omitted, joins the current night */
  code?: string;
};

export type DisplayJoinPayload = {
  code: string;
};

export type PeekLobbyPayload = {
  code: string;
};

export type PlayerJoinPayload = {
  code: string;
  playerName: string;
  mode: "solo" | "createTeam" | "joinTeam";
  teamName?: string;
  teamId?: string;
};

export type SubmitAnswerPayload = {
  optionIndex: number;
};

export type KickTeamPayload = {
  teamId: string;
};

export type AdjustScorePayload = {
  teamId: string;
  delta: number;
};

export type SetQuestionsPayload = {
  questions: Question[];
  timeLimitSec?: number;
};

export type ListNightsPayload = {
  query?: string;
  hostToken: string;
};

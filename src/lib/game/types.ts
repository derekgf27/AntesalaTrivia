export type Question = {
  id: string;
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  timeLimitSec: number;
};

export type Team = {
  id: string;
  name: string;
  isSolo: boolean;
  score: number;
};

export type Player = {
  id: string;
  name: string;
  teamId: string;
  lastSeenAt: number;
};

export type GamePhase = "lobby" | "question" | "locked" | "reveal" | "finished";

export type RevealInfo = {
  correctIndex: number;
  awarded: { teamId: string; points: number }[];
};

/** Safe for players + TV (no correct answers mid-question). */
export type PublicGameState = {
  code: string;
  title: string;
  scheduledDate: string;
  expectedTeams: number;
  phase: GamePhase;
  questionIndex: number;
  questionCount: number;
  question: {
    id: string;
    text: string;
    options: [string, string, string, string];
    timeLimitSec: number;
  } | null;
  timerEndsAt: number | null;
  timerPaused: boolean;
  timerPausedRemainingMs: number | null;
  /** Shared answer time for every question. */
  timeLimitSec: number;
  teams: Team[];
  reveal: RevealInfo | null;
  answeredTeamIds: string[];
};

export type AdminGameState = PublicGameState & {
  id: string;
  questions: Question[];
  currentAnswers: Record<string, number>;
  createdAt: string;
  /** Team IDs with at least one connected player socket. */
  connectedTeamIds: string[];
};

export type CreateNightInput = {
  scheduledDate?: string;
  expectedTeams: number;
  questions?: Question[];
};

export type NightRecord = {
  id: string;
  title: string;
  scheduledDate: string;
  code: string;
  expectedTeams: number;
  createdAt: string;
  finishedAt: string | null;
  phase: string;
  teams: Team[];
  /** Present on newer saves — needed to resume after server restart. */
  questions?: Question[];
  questionIndex?: number;
  reveal?: RevealInfo | null;
  timeLimitSec?: number;
};

export type ClientRole = "admin" | "display" | "player";

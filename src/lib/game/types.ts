export type Question = {
  id: string;
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  timeLimitSec: number;
  /** Consecutive questions with the same name are one topic. Blank means ungrouped. */
  topic?: string;
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

export type GamePhase =
  | "lobby"
  | "question"
  | "locked"
  | "reveal"
  | "topic"
  | "finished";

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
  /** Host toggle for the score column on the TV during a question. */
  showScores: boolean;
  /** Shared answer time for every question. */
  timeLimitSec: number;
  teams: Team[];
  reveal: RevealInfo | null;
  answeredTeamIds: string[];
  /** True while the spare question is the live round. */
  tiebreak: boolean;
  /** Teams allowed to answer the spare question. */
  tiebreakTeamIds: string[];
  /** Set once the night has more than one topic. */
  topic: {
    name: string;
    /** 1-based index within the topic. 0 while the topic card is up. */
    number: number;
    total: number;
  } | null;
};

export type AdminGameState = PublicGameState & {
  id: string;
  questions: Question[];
  currentAnswers: Record<string, number>;
  createdAt: string;
  /** Team IDs with at least one connected player socket. */
  connectedTeamIds: string[];
  spareQuestion: Question | null;
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
  spareQuestion?: Question | null;
};

export type ClientRole = "admin" | "display" | "player";

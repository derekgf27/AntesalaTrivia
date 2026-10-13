import type { Team } from "./types";

/** Teams sharing the highest score, when at least two are tied for first. */
export function tiedLeaders<T extends Pick<Team, "score">>(teams: T[]): T[] {
  if (teams.length < 2) return [];
  const top = Math.max(...teams.map((team) => team.score));
  const leaders = teams.filter((team) => team.score === top);
  return leaders.length >= 2 ? leaders : [];
}

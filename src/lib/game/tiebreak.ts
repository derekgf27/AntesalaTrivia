import type { Team } from "./types";

/** Every team on the top score, in the order given. One team when first is clear. */
export function firstPlace<T extends Pick<Team, "score">>(teams: T[]): T[] {
  if (teams.length === 0) return [];
  const top = Math.max(...teams.map((team) => team.score));
  return teams.filter((team) => team.score === top);
}

/** Teams sharing the highest score, when at least two are tied for first. */
export function tiedLeaders<T extends Pick<Team, "score">>(teams: T[]): T[] {
  const leaders = firstPlace(teams);
  return leaders.length >= 2 ? leaders : [];
}

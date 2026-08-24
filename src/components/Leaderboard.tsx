"use client";

import type { Team } from "@/lib/game/types";

export function Leaderboard({
  teams,
  highlightTeamId,
  compact = false,
}: {
  teams: Team[];
  highlightTeamId?: string;
  compact?: boolean;
}) {
  if (teams.length === 0) {
    return (
      <p className="text-[var(--muted)] text-sm">No teams yet — waiting for players.</p>
    );
  }

  return (
    <ol className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
      {teams.map((team, index) => {
        const active = team.id === highlightTeamId;
        return (
          <li
            key={team.id}
            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${
              active
                ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]"
                : "bg-[var(--surface)]"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`font-display tabular-nums tracking-normal ${
                  compact ? "text-lg" : "text-2xl"
                } ${index === 0 ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className={`font-semibold truncate ${compact ? "text-base" : "text-lg"}`}>
                  {team.name}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {team.isSolo ? "Solo" : "Team"}
                </p>
              </div>
            </div>
            <span
              className={`font-display tabular-nums tracking-normal ${compact ? "text-xl" : "text-3xl"}`}
            >
              {team.score}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

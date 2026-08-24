"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { Team } from "@/lib/game/types";
import { PLAYER_SESSION_KEY } from "@/lib/hostSession";
import { useGameState } from "@/lib/socket/GameProvider";

function JoinInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetCode = searchParams.get("code") || "";

  const { connected, playerJoin, peekLobby, error, setError } = useGameState();
  const [code, setCode] = useState(presetCode.toUpperCase());
  const [playerName, setPlayerName] = useState("");
  const [mode, setMode] = useState<"createTeam" | "joinTeam" | "solo">(
    "createTeam",
  );
  const [teamName, setTeamName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [lobbyTeams, setLobbyTeams] = useState<Team[]>([]);
  const [peeked, setPeeked] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    if (!code || !playerName.trim()) return false;
    if (mode === "createTeam") return Boolean(teamName.trim());
    if (mode === "joinTeam") return Boolean(teamId);
    return true;
  }, [code, playerName, mode, teamName, teamId]);

  useEffect(() => {
    if (mode !== "joinTeam") return;
    const trimmed = code.trim();
    if (trimmed.length < 4 || !connected) return;

    let cancelled = false;
    const handle = window.setTimeout(() => {
      peekLobby(trimmed)
        .then((res) => {
          if (cancelled) return;
          setLobbyTeams(res.teams);
          setPeeked(true);
          setError(null);
          setTeamId((prev) =>
            prev && res.teams.some((t) => t.id === prev) ? prev : "",
          );
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setLobbyTeams([]);
          setPeeked(true);
          setError(err instanceof Error ? err.message : "Could not load teams");
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [code, mode, connected, peekLobby, setError]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await playerJoin({
        code,
        playerName,
        mode,
        teamName,
        teamId: teamId || undefined,
      });
      sessionStorage.setItem(
        PLAYER_SESSION_KEY,
        JSON.stringify({
          code: code.toUpperCase(),
          playerName,
          playerId: res.playerId,
          teamId: res.teamId,
          teamName: res.teamName,
          mode,
        }),
      );
      router.push("/play");
    } catch {
      /* error state */
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <div>
        <Link href="/" className="text-sm text-[var(--muted)]">
          ← Home
        </Link>
        <h1 className="font-display mt-4 text-4xl">Join the night</h1>
        <p className="mt-2 text-[var(--muted)]">
          Enter the code from the TV, then play as a team or solo.
        </p>
      </div>

      <form className="card-panel flex flex-col gap-4 p-5" onSubmit={handleJoin}>
        <label className="space-y-2">
          <span className="text-sm text-[var(--muted)]">Lobby code</span>
          <input
            className="input uppercase tracking-[0.25em] text-center text-2xl"
            value={code}
            maxLength={6}
            required
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setPeeked(false);
              setLobbyTeams([]);
              setTeamId("");
            }}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm text-[var(--muted)]">Your name</span>
          <input
            className="input"
            value={playerName}
            required
            maxLength={24}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["createTeam", "New team"],
              ["joinTeam", "Join team"],
              ["solo", "Solo"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`btn ${mode === value ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "createTeam" && (
          <label className="space-y-2">
            <span className="text-sm text-[var(--muted)]">Team name</span>
            <input
              className="input"
              value={teamName}
              maxLength={28}
              placeholder="Table 4 Legends"
              onChange={(e) => setTeamName(e.target.value)}
            />
          </label>
        )}

        {mode === "joinTeam" && (
          <div className="space-y-3">
            {!peeked && code.length >= 4 && (
              <p className="text-sm text-[var(--muted)]">Loading teams…</p>
            )}
            {lobbyTeams.length === 0 && peeked && (
              <p className="text-sm text-[var(--muted)]">
                No open teams yet — create one instead.
              </p>
            )}
            <div className="grid gap-2">
              {lobbyTeams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  className={`rounded-xl px-4 py-3 text-left ${
                    teamId === team.id
                      ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]"
                      : "bg-[var(--surface-2)]"
                  }`}
                  onClick={() => setTeamId(team.id)}
                >
                  {team.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!connected || busy || !canSubmit}
        >
          Enter lobby
        </button>
      </form>

      {error && <p className="text-[var(--danger)]">{error}</p>}
      <p className="text-sm text-[var(--muted)]">
        Status: {connected ? "online" : "connecting…"}
      </p>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center text-[var(--muted)]">
          Loading…
        </main>
      }
    >
      <JoinInner />
    </Suspense>
  );
}

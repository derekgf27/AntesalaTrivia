"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import type { Team } from "@/lib/game/types";
import { PLAYER_SESSION_KEY } from "@/lib/hostSession";
import { useGameState } from "@/lib/socket/GameProvider";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetCode = searchParams.get("code") || "";
  const { t } = useLocale();

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

  const modeOptions = useMemo(
    () =>
      [
        ["createTeam", t("join.newTeam")] as const,
        ["joinTeam", t("join.joinTeam")] as const,
        ["solo", t("common.solo")] as const,
      ],
    [t],
  );

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
            prev && res.teams.some((team) => team.id === prev) ? prev : "",
          );
        })
        .catch(() => {
          if (cancelled) return;
          setLobbyTeams([]);
          setPeeked(true);
          setError(t("common.couldNotLoadTeams"));
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [code, mode, connected, peekLobby, setError, t]);

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
        <h1 className="font-display text-4xl">{t("join.title")}</h1>
        <p className="mt-2 text-[var(--muted)]">{t("join.subtitle")}</p>
      </div>

      <form className="card-panel flex flex-col gap-4 p-5" onSubmit={handleJoin}>
        <label className="space-y-2">
          <span className="text-sm text-[var(--muted)]">{t("join.lobbyCode")}</span>
          <input
            className="input text-center text-2xl uppercase tracking-[0.25em]"
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
          <span className="text-sm text-[var(--muted)]">{t("join.yourName")}</span>
          <input
            className="input"
            value={playerName}
            required
            maxLength={24}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-3 gap-2">
          {modeOptions.map(([value, label]) => (
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
            <span className="text-sm text-[var(--muted)]">{t("join.teamName")}</span>
            <input
              className="input"
              value={teamName}
              maxLength={28}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </label>
        )}

        {mode === "joinTeam" && (
          <div className="space-y-3">
            {!peeked && code.length >= 4 && (
              <p className="text-sm text-[var(--muted)]">{t("join.loadingTeams")}</p>
            )}
            {lobbyTeams.length === 0 && peeked && (
              <p className="text-sm text-[var(--muted)]">{t("join.noTeams")}</p>
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
          {t("join.enterLobby")}
        </button>
      </form>

      {error && <p className="text-[var(--danger)]">{error}</p>}
      <p className="text-sm text-[var(--muted)]">
        {t("join.status", {
          status: connected ? t("common.online") : t("common.connecting"),
        })}
      </p>
    </main>
  );
}

export default function JoinPage() {
  const { locale, t } = useLocale();

  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center text-[var(--muted)]">
          {t("common.loading")}
        </main>
      }
    >
      <JoinForm key={locale} />
    </Suspense>
  );
}

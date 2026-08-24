"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Leaderboard } from "@/components/Leaderboard";
import { TimerRing } from "@/components/TimerRing";
import { PLAYER_SESSION_KEY } from "@/lib/hostSession";
import { useGameState } from "@/lib/socket/GameProvider";

type StoredPlayer = {
  code: string;
  playerName: string;
  teamId: string;
  teamName: string;
  mode: "solo" | "createTeam" | "joinTeam";
};

export default function PlayPage() {
  const { connected, state, player, error, submitAnswer } = useGameState();
  const [stored, setStored] = useState<StoredPlayer | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(PLAYER_SESSION_KEY);
    if (!raw) return;
    try {
      setStored(JSON.parse(raw) as StoredPlayer);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setSelected(null);
  }, [state?.question?.id]);

  const teamId = player?.teamId || stored?.teamId;
  const teamName = player?.teamName || stored?.teamName;
  const answered = Boolean(teamId && state?.answeredTeamIds.includes(teamId));
  const myTeam = state?.teams.find((t) => t.id === teamId);
  const scoredThisRound = Boolean(
    teamId && state?.reveal?.awarded.some((a) => a.teamId === teamId),
  );

  if (!stored && !player) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="font-display text-3xl font-bold">No active session</h1>
        <p className="text-[var(--muted)]">Join a lobby first.</p>
        <Link href="/join" className="btn btn-primary text-center">
          Join
        </Link>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="grid min-h-dvh place-items-center text-[var(--muted)]">
        {connected
          ? `Connecting${stored ? ` to ${stored.code}` : ""}…`
          : "Reconnecting…"}
      </main>
    );
  }

  const q = state.question;
  const correctIndex = state.reveal?.correctIndex ?? null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            {state.code}
          </p>
          <h1 className="font-display text-2xl font-bold">{teamName}</h1>
          <p className="text-sm text-[var(--muted)]">
            {myTeam != null ? `${myTeam.score} pt${myTeam.score === 1 ? "" : "s"}` : "Playing along"}
          </p>
        </div>
        {state.phase === "question" && q && (
          <TimerRing
            timerEndsAt={state.timerEndsAt}
            paused={state.timerPaused}
            pausedRemainingMs={state.timerPausedRemainingMs}
            totalSec={state.timeLimitSec}
          />
        )}
      </header>

      {error && <p className="text-[var(--danger)] text-sm">{error}</p>}

      {state.phase === "lobby" && (
        <section className="rounded-3xl bg-[var(--navy)] px-5 py-6 ring-1 ring-[var(--line)]">
          <h2 className="font-display text-2xl font-bold">You&apos;re in</h2>
          <p className="mt-2 text-[var(--muted)]">
            Hang tight — the host will start the next question.
          </p>
        </section>
      )}

      {state.phase === "question" && q && (
        <section className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
              Q{state.questionIndex + 1}/{state.questionCount}
            </p>
            <h2 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
              {q.text}
            </h2>
          </div>
          <div className="grid gap-3">
            {q.options.map((opt, i) => {
              const isSelected = selected === i;
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={busy || !player}
                  className={`rounded-3xl px-5 py-4 text-left text-lg font-bold transition sm:text-xl ${
                    isSelected
                      ? "bg-[var(--navy)] text-[var(--cream)] ring-2 ring-[var(--accent)]"
                      : "bg-[var(--cream)] text-[var(--navy)]"
                  }`}
                  onClick={() => {
                    setSelected(i);
                    setBusy(true);
                    submitAnswer(i)
                      .catch(() => setSelected(null))
                      .finally(() => setBusy(false));
                  }}
                >
                  <span
                    className={`mr-2 font-extrabold ${
                      isSelected ? "text-[var(--accent)]" : "text-[var(--navy)]"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-[var(--muted)]">
            {!player
              ? "Reconnecting your seat…"
              : answered
                ? "Answer locked in for your team — you can still change it until time runs out."
                : "Pick an answer for your team."}
          </p>
        </section>
      )}

      {state.phase === "locked" && q && (
        <section className="space-y-4">
          <p className="font-display text-xl font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
            Answers locked
          </p>
          <h2 className="font-display text-2xl font-bold leading-tight">
            {q.text}
          </h2>
          <ul className="grid gap-3">
            {q.options.map((opt, i) => (
              <li
                key={opt}
                className={`rounded-3xl px-5 py-4 text-left text-lg font-bold text-[var(--navy)] ${
                  selected === i
                    ? "bg-[var(--cream)] ring-2 ring-[var(--accent)]"
                    : "bg-[var(--cream)] opacity-70"
                }`}
              >
                <span className="mr-2 font-extrabold">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
              </li>
            ))}
          </ul>
          <p className="text-[var(--muted)]">
            Time&apos;s up — revealing the correct answer…
          </p>
        </section>
      )}

      {state.phase === "reveal" && q && (
        <section className="space-y-4">
          <div
            className={`rounded-3xl px-5 py-4 ring-2 ${
              scoredThisRound
                ? "bg-[var(--accent-soft)] ring-[var(--accent)]"
                : "bg-[var(--navy)] ring-[var(--line)]"
            }`}
          >
            <p className="font-display text-2xl font-bold">
              {scoredThisRound ? "Correct! +1" : answered || selected != null ? "Missed" : "No answer"}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {myTeam != null
                ? `Your score: ${myTeam.score}`
                : "Waiting for the host…"}
            </p>
          </div>
          {correctIndex != null && (
            <div className="rounded-3xl bg-[var(--accent-soft)] px-5 py-4 ring-2 ring-[var(--accent)]">
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
                Correct answer
              </p>
              <p className="font-display mt-1 text-2xl font-bold">
                <span className="text-[var(--accent)]">
                  {String.fromCharCode(65 + correctIndex)}
                </span>
                <span className="mx-2 text-[var(--muted)]">·</span>
                {q.options[correctIndex]}
              </p>
            </div>
          )}
          <h2 className="font-display text-2xl font-bold leading-tight">
            {q.text}
          </h2>
          <ul className="grid gap-3">
            {q.options.map((opt, i) => {
              const showCorrect = correctIndex === i;
              const wasMine = selected === i;
              return (
                <li
                  key={opt}
                  className={`rounded-3xl px-5 py-4 text-left text-lg font-bold text-[var(--navy)] ${
                    showCorrect
                      ? "bg-[var(--cream)] ring-2 ring-[var(--accent)]"
                      : wasMine
                        ? "bg-[var(--cream)] ring-2 ring-[var(--danger)] opacity-80"
                        : "bg-[var(--cream)] opacity-45"
                  }`}
                >
                  <span className="mr-2 font-extrabold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </li>
              );
            })}
          </ul>
          <p className="text-[var(--muted)]">Waiting for the host to continue…</p>
        </section>
      )}

      {state.phase === "finished" && (
        <section className="space-y-5">
          <div className="rounded-3xl bg-[var(--navy)] px-5 py-6 ring-1 ring-[var(--line)]">
            <h2 className="font-display text-3xl font-bold">That&apos;s a wrap</h2>
            <p className="mt-2 text-[var(--muted)]">
              {myTeam != null
                ? `${teamName} finished with ${myTeam.score} point${myTeam.score === 1 ? "" : "s"}.`
                : "Thanks for playing."}
            </p>
          </div>
          <div className="card-panel p-5">
            <h3 className="font-display mb-3 text-2xl">Final board</h3>
            <Leaderboard teams={state.teams} highlightTeamId={teamId} />
          </div>
        </section>
      )}
    </main>
  );
}

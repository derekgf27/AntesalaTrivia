"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { Leaderboard } from "@/components/Leaderboard";
import { TimerRing } from "@/components/TimerRing";
import { firstPlace } from "@/lib/game/tiebreak";
import type { Team } from "@/lib/game/types";
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
  const { t } = useLocale();
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
  const myTeam = state?.teams.find((team) => team.id === teamId);
  const scoredThisRound = Boolean(
    teamId && state?.reveal?.awarded.some((a) => a.teamId === teamId),
  );

  if (!stored && !player) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="font-display text-3xl font-bold">{t("play.noSession")}</h1>
        <p className="text-[var(--muted)]">{t("play.joinFirst")}</p>
        <Link href="/join" className="btn btn-primary text-center">
          {t("play.join")}
        </Link>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="grid min-h-dvh place-items-center text-[var(--muted)]">
        {connected
          ? stored
            ? t("play.connectingTo", { code: stored.code })
            : t("play.connecting")
          : t("play.reconnecting")}
      </main>
    );
  }

  const inTiebreak = Boolean(state.tiebreak);
  const canAnswer =
    !inTiebreak || Boolean(teamId && state.tiebreakTeamIds.includes(teamId));
  const q = state.question;
  const correctIndex = state.reveal?.correctIndex ?? null;

  const pickedWrong =
    selected != null && correctIndex != null && selected !== correctIndex;
  const sittingOut = inTiebreak && !canAnswer;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 pb-8 pt-16 sm:pt-8">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            {state.code}
          </p>
          {state.phase !== "lobby" && (
            <>
              <h1 className="font-display text-2xl font-bold">{teamName}</h1>
              <p className="text-sm text-[var(--muted)]">
                {myTeam != null
                  ? pointsLabel(t, myTeam.score)
                  : t("play.playingAlong")}
              </p>
            </>
          )}
        </div>
        {state.phase === "question" && q && (
          <div className="shrink-0">
            <TimerRing
              timerEndsAt={state.timerEndsAt}
              paused={state.timerPaused}
              pausedRemainingMs={state.timerPausedRemainingMs}
              totalSec={state.timeLimitSec}
            />
          </div>
        )}
      </header>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {state.phase === "lobby" && (
        <section className="flex flex-1 flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
            {t("play.youreIn")}
          </p>
          <h1 className="font-display mt-3 text-5xl font-bold leading-none break-words sm:text-6xl">
            {teamName}
          </h1>
          <p className="font-display mt-4 text-3xl tabular-nums">
            {myTeam != null ? pointsLabel(t, myTeam.score) : t("play.playingAlong")}
          </p>
          <p className="mt-4 max-w-sm text-lg text-[var(--muted)]">{t("play.lobbyWait")}</p>
        </section>
      )}

      {state.phase === "question" && q && (
        <section className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
              {inTiebreak
                ? t("play.tiebreaker")
                : `Q${state.questionIndex + 1}/${state.questionCount}`}
            </p>
            <h2 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
              {q.text}
            </h2>
          </div>
          {canAnswer ? (
            <div className="grid gap-3">
              {q.options.map((opt, i) => {
                const isSelected = selected === i;
                const recede = selected != null && !isSelected;
                return (
                  <button
                    key={`${q.id}-${i}`}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={busy || !player}
                    className={`rounded-3xl px-5 py-4 text-left text-lg font-bold transition sm:text-xl ${
                      isSelected
                        ? "bg-[var(--navy)] text-[var(--cream)] ring-2 ring-[var(--accent)]"
                        : recede
                          ? "bg-[var(--cream)] text-[var(--navy)] opacity-40"
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
          ) : (
            <ReadOnlyOptions options={q.options} />
          )}
          <p className="text-sm text-[var(--muted)]">
            {sittingOut
              ? t("play.sittingOut")
              : !player
                ? t("play.reconnectSeat")
                : answered
                  ? t("play.answerLocked")
                  : t("play.pickAnswer")}
          </p>
        </section>
      )}

      {state.phase === "locked" && q && (
        <section className="space-y-4">
          <p className="font-display text-xl font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
            {inTiebreak ? t("play.tiebreaker") : t("play.answersLocked")}
          </p>
          <h2 className="font-display text-2xl font-bold leading-tight">{q.text}</h2>
          {canAnswer ? (
            <ul className="grid gap-3">
              {q.options.map((opt, i) => (
                <li
                  key={`${q.id}-${i}`}
                  className={`rounded-3xl px-5 py-4 text-left text-lg font-bold text-[var(--navy)] ${
                    selected === i
                      ? "bg-[var(--cream)] ring-2 ring-[var(--accent)]"
                      : "bg-[var(--cream)] opacity-40"
                  }`}
                >
                  <span className="mr-2 font-extrabold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </li>
              ))}
            </ul>
          ) : (
            <ReadOnlyOptions options={q.options} />
          )}
          <p className="text-[var(--muted)]">
            {sittingOut ? t("play.sittingOut") : t("play.timesUp")}
          </p>
        </section>
      )}

      {state.phase === "reveal" && q && (
        <section className="flex flex-1 flex-col justify-center gap-4">
          <div
            className={`rounded-3xl px-6 py-7 ring-2 ${
              scoredThisRound
                ? "bg-[var(--accent-soft)] ring-[var(--accent)]"
                : "bg-[var(--navy)] ring-[var(--line)]"
            }`}
          >
            <h2
              className={`font-display font-bold leading-tight ${
                sittingOut ? "text-3xl" : "text-4xl leading-none sm:text-5xl"
              }`}
            >
              {sittingOut
                ? t("play.sittingOut")
                : scoredThisRound
                  ? t("play.correct")
                  : answered || selected != null
                    ? t("play.missed")
                    : t("play.noAnswer")}
            </h2>
            <p className="font-display mt-4 text-2xl">
              {myTeam != null
                ? t("play.yourScore", { score: myTeam.score })
                : t("play.waitingHost")}
            </p>
          </div>
          {correctIndex != null && (
            <div className="rounded-3xl bg-[var(--accent-soft)] px-6 py-5 ring-2 ring-[var(--accent)]">
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--accent)]">
                {t("play.correctAnswer")}
              </p>
              <p className="font-display mt-2 text-3xl font-bold leading-tight">
                <span className="text-[var(--accent)]">
                  {String.fromCharCode(65 + correctIndex)}
                </span>
                <span className="mx-2 text-[var(--muted)]">·</span>
                {q.options[correctIndex]}
              </p>
            </div>
          )}
          {pickedWrong && selected != null && (
            <div className="rounded-3xl bg-[var(--navy)] px-6 py-5 ring-2 ring-[var(--danger)]">
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--danger)]">
                {t("play.yourAnswer")}
              </p>
              <p className="font-display mt-2 text-2xl font-bold leading-tight">
                <span className="text-[var(--danger)]">
                  {String.fromCharCode(65 + selected)}
                </span>
                <span className="mx-2 text-[var(--muted)]">·</span>
                {q.options[selected]}
              </p>
            </div>
          )}
          <p className="text-[var(--muted)]">{t("play.waitingContinue")}</p>
        </section>
      )}

      {state.phase === "finished" && (
        <section className="flex flex-1 flex-col justify-center gap-5">
          <FinishedResult
            teamName={teamName}
            myTeam={myTeam}
            winners={firstPlace(state.teams)}
          />
          <div className="card-panel p-5">
            <h3 className="font-display mb-3 text-2xl">{t("play.finalBoard")}</h3>
            <Leaderboard teams={state.teams} highlightTeamId={teamId} />
          </div>
        </section>
      )}
    </main>
  );
}

function pointsLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  count: number,
) {
  return count === 1
    ? t("play.points", { count })
    : t("play.pointsPlural", { count });
}

function ReadOnlyOptions({ options }: { options: string[] }) {
  return (
    <ul className="grid gap-3">
      {options.map((opt, i) => (
        <li
          key={`${i}-${opt}`}
          className="rounded-3xl bg-[var(--cream)] px-5 py-4 text-left text-lg font-bold text-[var(--navy)] opacity-45"
        >
          <span className="mr-2 font-extrabold">{String.fromCharCode(65 + i)}</span>
          {opt}
        </li>
      ))}
    </ul>
  );
}

function FinishedResult({
  teamName,
  myTeam,
  winners,
}: {
  teamName?: string;
  myTeam?: Team;
  winners: Team[];
}) {
  const { t } = useLocale();
  const iWon = Boolean(myTeam && winners.some((team) => team.id === myTeam.id));
  const tied = winners.length > 1;

  return (
    <div
      className={`rounded-3xl px-6 py-8 ${
        iWon
          ? "bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]"
          : "bg-[var(--navy)] ring-1 ring-[var(--line)]"
      }`}
    >
      <h2 className="font-display text-5xl font-bold leading-tight sm:text-6xl">
        {iWon ? (tied ? t("play.youTied") : t("play.youWon")) : t("play.wrap")}
      </h2>
      <p className="font-display mt-4 text-2xl">
        {myTeam != null
          ? myTeam.score === 1
            ? t("play.finishedPoints", {
                name: teamName ?? "",
                count: myTeam.score,
              })
            : t("play.finishedPointsPlural", {
                name: teamName ?? "",
                count: myTeam.score,
              })
          : t("play.thanks")}
      </p>
      {winners.length > 0 && !iWon && (
        <p className="mt-4 text-lg font-semibold">
          {winners.length === 1
            ? t("play.winnerLine", { name: winners[0].name })
            : t("play.winnersLine", {
                names: winners.map((team) => team.name).join(", "),
              })}
        </p>
      )}
    </div>
  );
}

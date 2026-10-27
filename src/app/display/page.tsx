"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Leaderboard } from "@/components/Leaderboard";
import { TimerRing } from "@/components/TimerRing";
import { useLocale } from "@/components/LocaleProvider";
import { LOBBY_CODE_LENGTH, clampLobbyCode } from "@/lib/game/code";
import { firstPlace } from "@/lib/game/tiebreak";
import { getRememberedDisplayCode } from "@/lib/hostSession";
import { useGameState } from "@/lib/socket/GameProvider";

function DisplayInner() {
  const searchParams = useSearchParams();
  const preset = searchParams.get("code") || "";
  const { t } = useLocale();
  const { connected, state, error, displayJoin } = useGameState();
  const [code, setCode] = useState(clampLobbyCode(preset));
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preset) return;
    const remembered = getRememberedDisplayCode();
    if (remembered) setCode(clampLobbyCode(remembered));
  }, [preset]);

  useEffect(() => {
    const target = preset || getRememberedDisplayCode() || "";
    if (!target || !connected || joined) return;
    setBusy(true);
    displayJoin(target)
      .then(() => {
        setJoined(true);
        setCode(target.toUpperCase());
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  }, [preset, connected, joined, displayJoin]);

  useEffect(() => {
    if (state?.code) setJoined(true);
  }, [state?.code]);

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined" || !state) return "";
    return `${window.location.origin}/join?code=${state.code}`;
  }, [state]);

  if (!joined || !state) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6">
        <h1 className="font-display text-4xl">{t("display.title")}</h1>
        <p className="text-[var(--muted)]">{t("display.subtitle")}</p>
        <input
          className="input uppercase tracking-[0.3em] text-center text-2xl"
          value={code}
          maxLength={LOBBY_CODE_LENGTH}
          onChange={(e) => setCode(clampLobbyCode(e.target.value))}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={!connected || busy || code.length < LOBBY_CODE_LENGTH}
          onClick={() => {
            setBusy(true);
            displayJoin(code)
              .then(() => setJoined(true))
              .catch(() => undefined)
              .finally(() => setBusy(false));
          }}
        >
          {t("display.connect")}
        </button>
        {error && <p className="text-[var(--danger)]">{error}</p>}
      </main>
    );
  }

  const q = state.question;
  const inPlay =
    state.phase === "question" ||
    state.phase === "locked" ||
    state.phase === "reveal";
  const progressLabel = state.tiebreak
    ? t("display.tiebreaker")
    : inPlay && state.questionCount > 0
      ? `Q${state.questionIndex + 1} / ${state.questionCount}`
      : null;
  const correctOpt =
    state.phase === "reveal" && state.reveal && q
      ? q.options[state.reveal.correctIndex]
      : null;
  const correctLetter =
    state.phase === "reveal" && state.reveal != null
      ? String.fromCharCode(65 + state.reveal.correctIndex)
      : null;
  const teamCountLabel =
    state.teams.length === 1
      ? t("display.teamsReady", { count: state.teams.length })
      : t("display.teamsReadyPlural", { count: state.teams.length });
  const winners = firstPlace(state.teams);
  const winningScore = winners[0]?.score ?? 0;

  return (
    <main className="flex min-h-dvh flex-col px-8 py-8 lg:px-14 lg:py-10">
      <header className="flex items-start justify-between gap-6">
        <div className="flex items-center gap-5">
          <Image
            src="/logo.jpg"
            alt={t("home.brand")}
            width={88}
            height={88}
            className="h-20 w-20 shrink-0 rounded-full object-cover shadow-[0_0_0_3px_var(--accent)] lg:h-24 lg:w-24"
          />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">
              {t("display.brand")}
            </p>
            <p className="mt-1 text-xl text-[var(--text)]">{state.title}</p>
            {progressLabel && (
              <p className="font-display mt-2 text-3xl tracking-wide text-[var(--accent)] sm:text-4xl">
                {progressLabel}
              </p>
            )}
          </div>
        </div>
        {inPlay && (
          <div className="text-right">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
              {t("display.lobbyCode")}
            </p>
            <p className="font-code mt-1 text-4xl text-[var(--accent)] lg:text-5xl">
              {state.code}
            </p>
          </div>
        )}
      </header>

      {state.phase === "lobby" && (
        <section className="mt-8 grid flex-1 items-center gap-10 lg:grid-cols-[auto_1fr] lg:gap-16">
          <div className="flex flex-col items-start gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">
                {t("display.lobbyOpen")}
              </p>
              <p className="font-code mt-3 text-7xl text-[var(--accent)] sm:text-8xl">
                {state.code}
              </p>
              <p className="mt-3 text-2xl text-[var(--cream)]">{teamCountLabel}</p>
            </div>
            {joinUrl && (
              <div className="rounded-2xl bg-white p-4">
                <QRCodeSVG value={joinUrl} size={220} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            {state.teams.length === 0 ? (
              <div>
                <h1 className="font-display text-5xl leading-tight sm:text-7xl">
                  {t("display.waitingTeams")}
                </h1>
                <p className="mt-4 max-w-2xl text-2xl text-[var(--muted)]">
                  {t("display.joinHint")}
                </p>
              </div>
            ) : (
              <div>
                <h1 className="font-display text-4xl sm:text-5xl">
                  {t("display.startingSoon")}
                </h1>
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {state.teams.map((team) => (
                    <li
                      key={team.id}
                      className="font-display text-3xl leading-tight sm:text-4xl"
                    >
                      {team.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {inPlay && q && (
        <section
          className={`mt-6 grid flex-1 items-center gap-8 ${
            state.showScores ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : ""
          }`}
        >
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
            {state.phase === "question" && (
              <div className="mb-6 flex flex-col items-center gap-2">
                <TimerRing
                  timerEndsAt={state.timerEndsAt}
                  paused={state.timerPaused}
                  pausedRemainingMs={state.timerPausedRemainingMs}
                  totalSec={state.timeLimitSec}
                  large
                />
                {state.timerPaused && (
                  <p className="font-display text-3xl uppercase tracking-[0.18em] text-[var(--muted)]">
                    {t("display.clockPaused")}
                  </p>
                )}
              </div>
            )}
            {state.phase === "locked" && (
              <p className="mb-5 font-display text-3xl uppercase tracking-[0.12em] text-[var(--accent)] sm:text-4xl">
                {t("display.answersLocked")}
              </p>
            )}
            {state.phase === "reveal" && correctOpt && correctLetter && (
              <div className="mb-7 w-full rounded-3xl bg-[var(--accent-soft)] px-7 py-5 ring-2 ring-[var(--accent)]">
                <p className="text-sm uppercase tracking-[0.25em] text-[var(--accent)]">
                  {t("display.correctAnswer")}
                </p>
                <p className="font-display mt-2 text-4xl leading-tight sm:text-5xl lg:text-6xl">
                  <span className="text-[var(--accent)]">{correctLetter}</span>
                  <span className="mx-3 text-[var(--muted)]">·</span>
                  {correctOpt}
                </p>
              </div>
            )}
            <h1 className="font-display max-w-4xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              {q.text}
            </h1>
            {state.tiebreak && (
              <p className="mt-4 text-2xl text-[var(--muted)]">
                {t("display.tiedTeams")}:{" "}
                {state.teams
                  .filter((team) => state.tiebreakTeamIds.includes(team.id))
                  .map((team) => team.name)
                  .join(", ")}
              </p>
            )}
            <ul className="mt-9 grid w-full gap-4 sm:grid-cols-2">
              {q.options.map((opt, i) => {
                const showCorrect =
                  state.phase === "reveal" &&
                  state.reveal?.correctIndex === i;
                const dimOthers = state.phase === "reveal" && !showCorrect;
                return (
                  <li
                    key={opt}
                    className={`rounded-3xl px-6 py-5 text-left text-xl font-bold text-[var(--navy)] sm:text-2xl lg:text-3xl ${
                      showCorrect
                        ? "bg-[var(--cream)] ring-2 ring-[var(--accent)]"
                        : dimOthers
                          ? "bg-[var(--cream)] opacity-45"
                          : "bg-[var(--cream)]"
                    }`}
                  >
                    <span className="mr-3 font-extrabold text-[var(--navy)]">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </li>
                );
              })}
            </ul>
            {state.phase === "question" && (
              <p className="mt-7 text-lg text-[var(--muted)] sm:text-xl">
                {state.answeredTeamIds.length === 1
                  ? t("display.teamsAnswered", {
                      count: state.answeredTeamIds.length,
                    })
                  : t("display.teamsAnsweredPlural", {
                      count: state.answeredTeamIds.length,
                    })}
              </p>
            )}
            {state.phase === "locked" && (
              <p className="mt-7 text-xl text-[var(--muted)]">
                {t("display.revealing")}
              </p>
            )}
          </div>
          {state.showScores && (
            <aside className="card-panel max-h-[70dvh] overflow-y-auto p-5">
              <h2 className="font-display mb-4 text-3xl">{t("display.leaderboard")}</h2>
              <Leaderboard teams={state.teams} />
            </aside>
          )}
        </section>
      )}

      {state.phase === "finished" && (
        <div className="grid flex-1 items-center gap-8 lg:grid-cols-[1.3fr_0.8fr] lg:gap-12">
          <section className="flex flex-col justify-center">
            {winners.length > 0 ? (
              <div className="rounded-3xl bg-[var(--accent-soft)] px-7 py-8 ring-2 ring-[var(--accent)]">
                <p className="text-sm uppercase tracking-[0.25em] text-[var(--accent)]">
                  {winners.length > 1 ? t("display.tie") : t("display.winner")}
                </p>
                <div className="mt-3 space-y-2">
                  {winners.map((team) => (
                    <h1
                      key={team.id}
                      className={`font-display font-bold leading-tight break-words ${
                        winners.length > 1
                          ? "text-5xl sm:text-6xl lg:text-7xl"
                          : "text-6xl sm:text-7xl lg:text-8xl"
                      }`}
                    >
                      {team.name}
                    </h1>
                  ))}
                </div>
                <p className="font-display mt-4 text-4xl tabular-nums sm:text-5xl">
                  {winningScore === 1
                    ? t("display.winnerPoints", { count: winningScore })
                    : t("display.winnerPointsPlural", { count: winningScore })}
                </p>
              </div>
            ) : (
              <h1 className="font-display text-6xl sm:text-8xl">{t("display.finalBoard")}</h1>
            )}
            <p className="mt-4 text-2xl text-[var(--muted)]">{t("display.thanks")}</p>
          </section>
          <aside className="card-panel p-6">
            <h2 className="font-display mb-4 text-3xl">{t("display.leaderboard")}</h2>
            <Leaderboard teams={state.teams} />
          </aside>
        </div>
      )}
    </main>
  );
}

export default function DisplayPage() {
  const { t } = useLocale();

  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center text-[var(--muted)]">
          {t("display.loading")}
        </main>
      }
    >
      <DisplayInner />
    </Suspense>
  );
}

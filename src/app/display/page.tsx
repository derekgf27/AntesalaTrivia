"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Leaderboard } from "@/components/Leaderboard";
import { TimerRing } from "@/components/TimerRing";
import { getRememberedDisplayCode } from "@/lib/hostSession";
import { useGameState } from "@/lib/socket/GameProvider";

function DisplayInner() {
  const searchParams = useSearchParams();
  const preset = searchParams.get("code") || "";
  const { connected, state, error, displayJoin } = useGameState();
  const [code, setCode] = useState(preset);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(true);

  useEffect(() => {
    if (preset) return;
    const remembered = getRememberedDisplayCode();
    if (remembered) setCode(remembered);
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
        <h1 className="font-display text-4xl">TV display</h1>
        <p className="text-[var(--muted)]">
          Enter the lobby code, then drag this window to your TV and press F11.
        </p>
        <input
          className="input uppercase tracking-[0.3em] text-center text-2xl"
          value={code}
          maxLength={6}
          placeholder="CODE"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={!connected || busy || code.length < 4}
          onClick={() => {
            setBusy(true);
            displayJoin(code)
              .then(() => setJoined(true))
              .catch(() => undefined)
              .finally(() => setBusy(false));
          }}
        >
          Connect display
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
  const progressLabel =
    inPlay && state.questionCount > 0
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
  const teamCountLabel = `${state.teams.length} team${
    state.teams.length === 1 ? "" : "s"
  } ready`;

  return (
    <main className="flex min-h-dvh flex-col px-8 pt-5 pb-8 lg:px-14 lg:pt-6 lg:pb-10">
      <header
        className={`mb-6 grid items-start gap-4 lg:mb-8 ${
          inPlay
            ? "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
            : "flex justify-between"
        }`}
      >
        <div className="flex items-center gap-5">
          <Image
            src="/logo.jpg"
            alt="La Antesala"
            width={88}
            height={88}
            className="h-20 w-20 shrink-0 rounded-full object-cover shadow-[0_0_0_3px_var(--accent)] lg:h-24 lg:w-24"
          />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">
              La Antesala Trivia
            </p>
            <p className="mt-1 text-xl text-[var(--text)]">{state.title}</p>
            {progressLabel && (
              <p className="font-display mt-2 text-3xl tracking-wide text-[var(--accent)] sm:text-4xl">
                {progressLabel}
              </p>
            )}
          </div>
        </div>

        {state.phase === "question" && q ? (
          <div className="justify-self-center self-start pt-0">
            <TimerRing
              timerEndsAt={state.timerEndsAt}
              paused={state.timerPaused}
              pausedRemainingMs={state.timerPausedRemainingMs}
              totalSec={state.timeLimitSec}
              large
            />
          </div>
        ) : inPlay ? (
          <div />
        ) : null}

        {state.phase === "lobby" && (
          <div className="ml-auto flex flex-col items-end gap-4">
            <div className="flex items-center gap-6 rounded-2xl bg-[var(--navy)] px-6 py-4 ring-1 ring-[var(--line)] sm:gap-8 sm:px-8">
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--accent)] sm:text-sm">
                  Lobby open
                </p>
                <p className="font-display mt-2 text-lg text-[var(--cream)] sm:text-xl">
                  {teamCountLabel}
                </p>
              </div>
              <p className="font-code text-5xl text-[var(--accent)] sm:text-6xl lg:text-7xl">
                {state.code}
              </p>
            </div>
            <button
              type="button"
              className="text-sm uppercase tracking-[0.2em] text-[var(--muted)] transition hover:text-[var(--text)]"
              onClick={() => setShowQr((v) => !v)}
              aria-expanded={showQr}
            >
              {showQr ? "Hide QR" : "Show QR"}
            </button>
            {showQr && joinUrl && (
              <div className="rounded-2xl bg-white p-4">
                <QRCodeSVG value={joinUrl} size={180} />
              </div>
            )}
          </div>
        )}

        {inPlay && (
          <div className="relative z-20 justify-self-end">
            <div className="text-right">
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
                Lobby code
              </p>
              <p className="font-code mt-1 text-5xl text-[var(--accent)] lg:text-6xl">
                {state.code}
              </p>
            </div>
            {/* Overlay so expand/collapse never pushes the question block */}
            <div className="absolute right-0 top-full mt-4 w-[min(calc(100vw-4rem),22rem)]">
              <div className="card-panel p-5 shadow-2xl">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setShowLeaderboard((v) => !v)}
                  aria-expanded={showLeaderboard}
                >
                  <h2 className="font-display text-2xl">Leaderboard</h2>
                  <span className="text-sm text-[var(--muted)]">
                    {showLeaderboard ? "Hide" : "Show"}
                  </span>
                </button>
                {showLeaderboard && (
                  <div className="mt-4 max-h-[min(50dvh,28rem)] overflow-y-auto">
                    <Leaderboard teams={state.teams} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {state.phase === "lobby" && (
        <section className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="font-display text-5xl leading-tight sm:text-7xl">
            Game starting soon
          </h1>
          <p className="mt-4 max-w-2xl text-2xl text-[var(--muted)]">
            Join with the lobby code — the host will kick things off when
            everyone&apos;s ready.
          </p>
        </section>
      )}

      {inPlay && q && (
        <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center pt-2 text-center">
          {state.phase === "locked" && (
            <p className="mb-5 font-display text-3xl uppercase tracking-[0.12em] text-[var(--accent)] sm:text-4xl">
              Answers locked
            </p>
          )}
          {state.phase === "reveal" && correctOpt && correctLetter && (
            <div className="mb-7 w-full rounded-3xl bg-[var(--accent-soft)] px-7 py-5 ring-2 ring-[var(--accent)]">
              <p className="text-sm uppercase tracking-[0.25em] text-[var(--accent)]">
                Correct answer
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
              {state.answeredTeamIds.length} team
              {state.answeredTeamIds.length === 1 ? "" : "s"} answered
            </p>
          )}
          {state.phase === "locked" && (
            <p className="mt-7 text-xl text-[var(--muted)]">
              Revealing the answer…
            </p>
          )}
        </section>
      )}

      {state.phase === "finished" && (
        <div className="grid flex-1 items-start gap-8 lg:grid-cols-[1.2fr_0.9fr] lg:gap-12">
          <section className="flex flex-col justify-center">
            <h1 className="font-display text-6xl sm:text-8xl">Final board</h1>
            <p className="mt-4 text-2xl text-[var(--muted)]">
              Thanks for playing — see you next trivia night.
            </p>
          </section>
          <aside className="card-panel p-6">
            <h2 className="font-display mb-4 text-3xl">Leaderboard</h2>
            <Leaderboard teams={state.teams} />
          </aside>
        </div>
      )}
    </main>
  );
}

export default function DisplayPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center text-[var(--muted)]">
          Loading display…
        </main>
      }
    >
      <DisplayInner />
    </Suspense>
  );
}

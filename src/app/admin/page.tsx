"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HostBreadcrumbs } from "@/components/HostBreadcrumbs";
import { HostNightModal } from "@/components/HostNightModal";
import { useLocale } from "@/components/LocaleProvider";
import { TimerRing } from "@/components/TimerRing";
import { SAMPLE_QUESTIONS } from "@/lib/game/sampleQuestions";
import type { Question } from "@/lib/game/types";
import { isHostUnlocked } from "@/lib/hostSession";
import { useGameState } from "@/lib/socket/GameProvider";

function blankQuestion(): Question {
  return {
    id: crypto.randomUUID(),
    text: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    timeLimitSec: 30,
  };
}

function phaseLabel(
  phase: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  switch (phase) {
    case "lobby":
      return t("admin.phaseLobby");
    case "question":
      return t("admin.phaseLive");
    case "locked":
      return t("admin.phaseLocked");
    case "reveal":
      return t("admin.phaseReveal");
    default:
      return t("admin.phaseFinished");
  }
}

export default function AdminPage() {
  const { t } = useLocale();
  const router = useRouter();
  const {
    connected,
    adminState,
    error,
    setError,
    createGame,
    adminJoin,
    listNights,
    deleteNight,
    startQuestion,
    forceLock,
    pauseTimer,
    resumeTimer,
    restartTimer,
    nextQuestion,
    kickTeam,
    adjustScore,
    setQuestions,
    endGame,
  } = useGameState();

  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(true);
  const [draftQuestions, setDraftQuestions] = useState<Question[]>(SAMPLE_QUESTIONS);
  const [draftTimeLimit, setDraftTimeLimit] = useState(30);
  const [modalOpen, setModalOpen] = useState(true);
  const [atHostHome, setAtHostHome] = useState(true);
  const [hostReady, setHostReady] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [confirmEndNight, setConfirmEndNight] = useState(false);

  useEffect(() => {
    if (!isHostUnlocked()) {
      router.replace("/");
      return;
    }
    setHostReady(true);
  }, [router]);

  useEffect(() => {
    if (adminState && !atHostHome) {
      setModalOpen(false);
    }
  }, [adminState, atHostHome]);

  useEffect(() => {
    if (!adminState) return;
    if (adminState.phase === "lobby") {
      setQuestionsOpen(true);
    } else {
      setQuestionsOpen(false);
      setEditing(false);
    }
  }, [adminState?.phase, adminState]);

  const displayUrl = useMemo(() => {
    if (typeof window === "undefined" || !adminState) return "";
    return `${window.location.origin}/display?code=${adminState.code}`;
  }, [adminState]);

  const handleLoadHistory = useCallback(
    (query: string) => listNights(query),
    [listNights],
  );

  function goToHostHome() {
    setAtHostHome(true);
    setModalOpen(true);
  }

  function goToNight() {
    setAtHostHome(false);
    setModalOpen(false);
  }

  const hostCrumbs = (
    <HostBreadcrumbs
      nightTitle={adminState?.title}
      phase={adminState?.phase}
      atHostHome={modalOpen || !adminState}
      onHostHome={goToHostHome}
      onOpenNight={adminState ? goToNight : undefined}
    />
  );

  async function handleCreate(input: { scheduledDate: string }) {
    setBusy(true);
    setError(null);
    try {
      await createGame({
        scheduledDate: input.scheduledDate,
        expectedTeams: 64,
        questions: SAMPLE_QUESTIONS.map((q) => ({
          ...q,
          id: crypto.randomUUID(),
        })),
      });
      setAtHostHome(false);
      setModalOpen(false);
    } catch {
      /* surfaced */
    } finally {
      setBusy(false);
    }
  }

  async function handleResume() {
    setBusy(true);
    setError(null);
    try {
      await adminJoin();
      setAtHostHome(false);
      setModalOpen(false);
    } catch {
      /* surfaced */
    } finally {
      setBusy(false);
    }
  }

  async function handleResumeNight(code: string) {
    setBusy(true);
    setError(null);
    try {
      await adminJoin(code);
      setAtHostHome(false);
      setModalOpen(false);
    } catch {
      /* surfaced */
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteNight(nightId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteNight(nightId);
      setAtHostHome(true);
      setModalOpen(true);
    } catch {
      /* surfaced */
    } finally {
      setBusy(false);
    }
  }

  async function saveQuestions() {
    setBusy(true);
    try {
      const cleaned = draftQuestions
        .map((q) => ({
          ...q,
          text: q.text.trim(),
          options: q.options.map((o) => o.trim()) as Question["options"],
          timeLimitSec: draftTimeLimit,
        }))
        .filter((q) => q.text && q.options.every(Boolean));
      if (!cleaned.length) throw new Error(t("admin.needQuestion"));
      await setQuestions(cleaned, draftTimeLimit);
      setEditing(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : t("common.couldNotSave"));
    } finally {
      setBusy(false);
    }
  }

  if (!hostReady) {
    return (
      <main className="grid min-h-dvh place-items-center text-[var(--muted)]">
        {t("admin.checking")}
      </main>
    );
  }

  if (!adminState || modalOpen) {
    return (
      <main className="relative min-h-dvh">
        <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 px-6 py-12">
          {hostCrumbs}
          <h1 className="font-display text-4xl">{t("admin.title")}</h1>
          <p className="text-[var(--muted)]">{t("admin.subtitle")}</p>
          {connected && !adminState && (
            <p className="text-sm text-[var(--muted)]">
              {t("admin.reconnecting")}
            </p>
          )}
        </div>
        <HostNightModal
          open
          connected={connected}
          busy={busy}
          error={error}
          breadcrumbs={hostCrumbs}
          onCreate={handleCreate}
          onResume={handleResume}
          onResumeNight={handleResumeNight}
          onDeleteNight={handleDeleteNight}
          onLoadHistory={handleLoadHistory}
        />
      </main>
    );
  }

  const phase = adminState.phase;
  const q = adminState.question;
  const moreAfterReveal =
    phase === "reveal" && adminState.questionIndex + 1 < adminState.questionCount;
  const isLastReveal =
    phase === "reveal" && adminState.questionIndex + 1 >= adminState.questionCount;
  const answeredCount = adminState.answeredTeamIds.length;
  const teamCount = adminState.teams.length;
  const connectedCount = adminState.connectedTeamIds?.length ?? 0;
  const liveControls =
    phase === "question" || phase === "locked" || phase === "reveal";

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="flex flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {hostCrumbs}
            <p className="mt-3 text-sm uppercase tracking-[0.2em] text-[var(--accent)]">
              {t("admin.control")}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl">{adminState.title}</h1>
            <p className="text-sm text-[var(--muted)]">
              {teamCount === 1
                ? t("admin.teamOne", { count: teamCount })
                : t("admin.teamMany", { count: teamCount })}
              {teamCount > 0
                ? t("admin.connected", { count: connectedCount })
                : ""}
            </p>
          </div>
          <div className="card-panel flex items-center gap-4 px-4 py-3">
            <div className="text-right">
              <p className="text-xs text-[var(--muted)]">{t("admin.lobbyCode")}</p>
              <p className="font-code text-3xl">{adminState.code}</p>
            </div>
            <div className="h-10 w-px bg-[var(--line)]" aria-hidden />
            <p className="font-display text-xl capitalize text-[var(--accent)]">
              {phaseLabel(phase, t)}
            </p>
          </div>
        </header>

        {error && (
          <p className="danger-soft-panel flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-[var(--danger)]">
            <span>{error}</span>
            <button
              type="button"
              className="shrink-0 text-sm text-[var(--muted)] hover:text-[var(--text)]"
              onClick={() => setError(null)}
            >
              {t("common.dismiss")}
            </button>
          </p>
        )}

        <div
          className={`card-panel flex flex-wrap items-center gap-3 p-4 ${
            liveControls ? "ring-1 ring-[var(--accent)]" : ""
          }`}
        >
          {phase === "lobby" && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => startQuestion().catch(() => undefined)}
            >
              {t("admin.startQ1")}
            </button>
          )}
          {phase === "question" && (
            <>
              {adminState.timerPaused ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    resumeTimer().catch((e) =>
                      setError(
                        e instanceof Error ? e.message : t("admin.couldNotResume"),
                      ),
                    )
                  }
                >
                  {t("admin.resumeClock")}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    pauseTimer().catch((e) =>
                      setError(
                        e instanceof Error ? e.message : t("admin.couldNotPause"),
                      ),
                    )
                  }
                >
                  {t("admin.pauseClock")}
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() =>
                  restartTimer().catch((e) =>
                    setError(
                      e instanceof Error ? e.message : t("admin.couldNotRestart"),
                    ),
                  )
                }
              >
                {t("admin.restartClock")}
              </button>
              <button
                type="button"
                className="btn btn-warning"
                disabled={busy}
                onClick={() => forceLock().catch(() => undefined)}
              >
                {t("admin.lockNow")}
              </button>
            </>
          )}
          {phase === "locked" && (
            <button
              type="button"
              className="btn btn-warning"
              disabled={busy}
              onClick={() => forceLock().catch(() => undefined)}
            >
              {t("admin.revealNow")}
            </button>
          )}
          {moreAfterReveal && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => nextQuestion().catch(() => undefined)}
            >
              {t("admin.nextQuestion")}
            </button>
          )}
          {isLastReveal && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => nextQuestion().catch(() => undefined)}
            >
              {t("admin.finalLeaderboard")}
            </button>
          )}
          <div className="ml-auto flex flex-col items-end gap-1">
            {(phase === "question" || phase === "locked") && (
              <p className="font-display text-2xl text-[var(--accent)] sm:text-3xl">
                {t("admin.answered", {
                  answered: answeredCount,
                  total: teamCount,
                })}
              </p>
            )}
            <span className="text-sm text-[var(--muted)] capitalize">
              {phase !== "lobby" && phase !== "finished"
                ? `Q${adminState.questionIndex + 1}/${adminState.questionCount}`
                : ""}
            </span>
          </div>
        </div>

        {(phase === "question" || phase === "locked" || phase === "reveal") &&
          q && (
          <div className="card-panel p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {phase === "question" ? (
                <TimerRing
                  timerEndsAt={adminState.timerEndsAt}
                  paused={adminState.timerPaused}
                  pausedRemainingMs={adminState.timerPausedRemainingMs}
                  totalSec={adminState.timeLimitSec}
                />
              ) : null}
              <div className="flex-1">
                <p className="text-sm text-[var(--muted)]">
                  {t("admin.questionN", { n: adminState.questionIndex + 1 })}
                  {phase === "locked"
                    ? t("admin.questionLocked")
                    : adminState.timerPaused
                      ? t("admin.clockPaused")
                      : ""}
                </p>
                <h2 className="font-display text-2xl leading-tight">{q.text}</h2>
                <ul className="mt-4 grid gap-2">
                  {q.options.map((opt, i) => {
                    const isCorrect =
                      phase === "reveal" &&
                      adminState.reveal?.correctIndex === i;
                    const answerCount = Object.values(
                      adminState.currentAnswers,
                    ).filter((v) => v === i).length;
                    return (
                      <li
                        key={opt}
                        className={`rounded-xl px-3 py-2 ${
                          isCorrect
                            ? "bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]"
                            : "bg-[var(--surface-2)]"
                        }`}
                      >
                        <span className="text-[var(--muted)] mr-2">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        {opt}
                        <span className="float-right text-sm text-[var(--muted)]">
                          {t("admin.answersShort", { count: answerCount })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        )}

        {phase === "finished" && (
          <div className="card-panel space-y-4 p-5">
            <h2 className="font-display text-3xl">{t("admin.nightComplete")}</h2>
            <p className="text-[var(--muted)]">{t("admin.nightCompleteHint")}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={goToHostHome}
            >
              {t("admin.newNight")}
            </button>
          </div>
        )}

        <div className="card-panel p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              className="flex items-center gap-3 text-left"
              onClick={() => setQuestionsOpen((v) => !v)}
              aria-expanded={questionsOpen}
            >
              <h3 className="font-display text-xl">{t("admin.questions")}</h3>
              <span className="text-sm text-[var(--muted)]">
                {questionsOpen ? t("admin.hide") : t("admin.show")}
              </span>
            </button>
            {phase !== "finished" && questionsOpen && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setDraftQuestions(
                    adminState.questions.length
                      ? adminState.questions
                      : [blankQuestion()],
                  );
                  setDraftTimeLimit(adminState.timeLimitSec || 30);
                  setEditing((v) => !v);
                }}
              >
                {editing ? t("admin.closeEditor") : t("admin.edit")}
              </button>
            )}
          </div>
          {questionsOpen &&
            (!editing ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  {t("admin.answerTime", { sec: adminState.timeLimitSec })}
                </p>
                <ol className="space-y-2 text-sm text-[var(--muted)]">
                  {adminState.questions.map((item, idx) => (
                    <li key={item.id}>
                      {idx + 1}. {item.text}
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="space-y-6">
                <label className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                  {t("admin.answerTimeLabel")}
                  <input
                    className="input max-w-28"
                    type="number"
                    min={5}
                    max={180}
                    value={draftTimeLimit}
                    onChange={(e) =>
                      setDraftTimeLimit(Number(e.target.value) || 30)
                    }
                  />
                </label>
                {draftQuestions.map((item, qi) => (
                  <div
                    key={item.id}
                    className="space-y-2 rounded-xl bg-[var(--surface-2)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-[var(--muted)]">
                        {t("admin.questionN", { n: qi + 1 })}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost px-3 py-1.5 text-xs"
                          disabled={qi === 0}
                          onClick={() => {
                            if (qi === 0) return;
                            const next = [...draftQuestions];
                            [next[qi - 1], next[qi]] = [next[qi], next[qi - 1]];
                            setDraftQuestions(next);
                          }}
                        >
                          {t("admin.up")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost px-3 py-1.5 text-xs"
                          disabled={qi === draftQuestions.length - 1}
                          onClick={() => {
                            if (qi >= draftQuestions.length - 1) return;
                            const next = [...draftQuestions];
                            [next[qi], next[qi + 1]] = [next[qi + 1], next[qi]];
                            setDraftQuestions(next);
                          }}
                        >
                          {t("admin.down")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost px-3 py-1.5 text-xs"
                          onClick={() => {
                            const copy: Question = {
                              ...item,
                              id: crypto.randomUUID(),
                              options: [...item.options] as Question["options"],
                            };
                            const next = [...draftQuestions];
                            next.splice(qi + 1, 0, copy);
                            setDraftQuestions(next);
                          }}
                        >
                          {t("admin.duplicate")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost px-3 py-1.5 text-xs text-[var(--danger)]"
                          disabled={draftQuestions.length <= 1}
                          onClick={() => {
                            if (draftQuestions.length <= 1) return;
                            setDraftQuestions((list) =>
                              list.filter((_, i) => i !== qi),
                            );
                          }}
                        >
                          {t("admin.remove")}
                        </button>
                      </div>
                    </div>
                    <input
                      className="input"
                      value={item.text}
                      onChange={(e) => {
                        const next = [...draftQuestions];
                        next[qi] = { ...item, text: e.target.value };
                        setDraftQuestions(next);
                      }}
                    />
                    {item.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${item.id}`}
                          checked={item.correctIndex === oi}
                          onChange={() => {
                            const next = [...draftQuestions];
                            next[qi] = {
                              ...item,
                              correctIndex: oi as 0 | 1 | 2 | 3,
                            };
                            setDraftQuestions(next);
                          }}
                        />
                        <input
                          className="input"
                          value={opt}
                          onChange={(e) => {
                            const next = [...draftQuestions];
                            const options = [...item.options] as Question["options"];
                            options[oi] = e.target.value;
                            next[qi] = { ...item, options };
                            setDraftQuestions(next);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setDraftQuestions((qlist) => [...qlist, blankQuestion()])
                    }
                  >
                    {t("admin.addQuestion")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={saveQuestions}
                  >
                    {t("admin.saveQuestions")}
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section>

      <aside className="flex flex-col gap-5">
        <div className="card-panel p-5">
          <h3 className="font-display text-xl mb-3">{t("admin.tvDisplay")}</h3>
          {displayUrl && (
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={() =>
                window.open(displayUrl, "antesala-tv", "noopener,noreferrer")
              }
            >
              {t("admin.openTv")}
            </button>
          )}
        </div>

        <div className="card-panel p-5">
          <button
            type="button"
            className="mb-3 flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setShowLeaderboard((v) => !v)}
            aria-expanded={showLeaderboard}
          >
            <h3 className="font-display text-xl">{t("admin.lobbyScores")}</h3>
            <span className="text-sm text-[var(--muted)]">
              {showLeaderboard ? t("admin.hide") : t("admin.show")}
            </span>
          </button>
          {showLeaderboard && (
            <ul className="space-y-3">
              {adminState.teams.length === 0 ? (
                <li className="text-sm text-[var(--muted)]">
                  {t("admin.noTeams")}
                </li>
              ) : (
                adminState.teams.map((team, index) => {
                  const isConnected = adminState.connectedTeamIds?.includes(
                    team.id,
                  );
                  return (
                    <li
                      key={team.id}
                      className="rounded-xl bg-[var(--surface-2)] px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            <span className="text-[var(--muted)] mr-2">
                              {index + 1}.
                            </span>
                            {team.name}
                          </p>
                          <p
                            className={`mt-1 text-xs ${
                              isConnected
                                ? "text-[var(--accent)]"
                                : "text-[var(--muted)]"
                            }`}
                          >
                            {isConnected
                              ? t("admin.connectedStatus")
                              : t("admin.disconnected")}
                            {team.isSolo
                              ? ` · ${t("common.solo")}`
                              : ` · ${t("common.team")}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="btn btn-ghost px-3 py-1.5 text-sm"
                            disabled={busy || team.score <= 0}
                            onClick={() =>
                              adjustScore(team.id, -1).catch(() => undefined)
                            }
                            aria-label={t("admin.subtractPoint", { name: team.name })}
                          >
                            −
                          </button>
                          <span className="font-display min-w-8 text-center text-2xl tabular-nums">
                            {team.score}
                          </span>
                          <button
                            type="button"
                            className="btn btn-ghost px-3 py-1.5 text-sm"
                            disabled={busy}
                            onClick={() =>
                              adjustScore(team.id, 1).catch(() => undefined)
                            }
                            aria-label={t("admin.addPoint", { name: team.name })}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          className="text-sm text-[var(--danger)]"
                          disabled={busy}
                          onClick={() =>
                            kickTeam(team.id).catch(() => undefined)
                          }
                        >
                          {t("admin.kick")}
                        </button>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>

        {phase !== "finished" && (
          <div className="mt-auto rounded-2xl border border-[var(--line)] p-4">
            {!confirmEndNight ? (
              <button
                type="button"
                className="btn btn-danger w-full"
                disabled={busy}
                onClick={() => setConfirmEndNight(true)}
              >
                {t("admin.endNight")}
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  {t("admin.endConfirm")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => {
                      endGame()
                        .then(() => setConfirmEndNight(false))
                        .catch(() => undefined);
                    }}
                  >
                    {t("admin.yesEnd")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => setConfirmEndNight(false)}
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </main>
  );
}

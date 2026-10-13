"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HostBreadcrumbs } from "@/components/HostBreadcrumbs";
import { HostNightModal } from "@/components/HostNightModal";
import { HostPinModal } from "@/components/HostPinModal";
import { QuestionEditor } from "@/components/QuestionEditor";
import { useLocale } from "@/components/LocaleProvider";
import { TimerRing } from "@/components/TimerRing";
import { SAMPLE_QUESTIONS } from "@/lib/game/sampleQuestions";
import { tiedLeaders } from "@/lib/game/tiebreak";
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
    setShowScores,
    returnToLobby,
    restartNight,
    startTiebreak,
    endGame,
  } = useGameState();

  const [hostReady, setHostReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(true);
  const [draftQuestions, setDraftQuestions] = useState<Question[]>(SAMPLE_QUESTIONS);
  const [draftSpare, setDraftSpare] = useState<Question>(blankQuestion);
  const [draftTimeLimit, setDraftTimeLimit] = useState(30);
  const [modalOpen, setModalOpen] = useState(true);
  const [atHostHome, setAtHostHome] = useState(true);
  const [confirmEndNight, setConfirmEndNight] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    setHostReady(isHostUnlocked());
  }, []);

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
      setConfirmDiscard(false);
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

  const draftDirty = useMemo(() => {
    if (!adminState || !editing) return false;
    const signature = (questions: Question[], limit: number) =>
      JSON.stringify(
        questions.map((q) => ({
          id: q.id,
          text: q.text.trim(),
          options: q.options.map((option) => option.trim()),
          correctIndex: q.correctIndex,
          timeLimitSec: limit,
        })),
      );
    const spareSignature = (question: Question | null | undefined) => {
      const text = question?.text.trim() ?? "";
      const options = question?.options.map((option) => option.trim()) ?? [
        "",
        "",
        "",
        "",
      ];
      if (!text && options.every((option) => !option)) return "";
      return JSON.stringify({
        text,
        options,
        correctIndex: question?.correctIndex ?? 0,
      });
    };
    return (
      draftTimeLimit !== (adminState.timeLimitSec || 30) ||
      signature(draftQuestions, draftTimeLimit) !==
        signature(adminState.questions, adminState.timeLimitSec || 30) ||
      spareSignature(draftSpare) !== spareSignature(adminState.spareQuestion)
    );
  }, [adminState, draftQuestions, draftSpare, draftTimeLimit, editing]);

  function cleanedDraft() {
    const incomplete = draftQuestions.some(
      (q) => !q.text.trim() || q.options.some((option) => !option.trim()),
    );
    if (incomplete) throw new Error(t("admin.finishQuestions"));
    return draftQuestions.map((q) => ({
      ...q,
      text: q.text.trim(),
      options: q.options.map((option) => option.trim()) as Question["options"],
      timeLimitSec: draftTimeLimit,
    }));
  }

  function cleanedSpare(): Question | null {
    const text = draftSpare.text.trim();
    const options = draftSpare.options.map((option) => option.trim());
    const empty = !text && options.every((option) => !option);
    if (empty) return null;
    if (!text || options.some((option) => !option)) {
      throw new Error(t("admin.finishTiebreaker"));
    }
    return {
      ...draftSpare,
      text,
      options: options as Question["options"],
      timeLimitSec: draftTimeLimit,
    };
  }

  async function saveQuestions() {
    setBusy(true);
    setError(null);
    try {
      await setQuestions(cleanedDraft(), draftTimeLimit, cleanedSpare());
      setConfirmDiscard(false);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.couldNotSave"));
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      if (editing && draftDirty) {
        await setQuestions(cleanedDraft(), draftTimeLimit, cleanedSpare());
        setConfirmDiscard(false);
        setEditing(false);
      }
      await startQuestion();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.couldNotSave"));
    } finally {
      setBusy(false);
    }
  }

  function requestCloseEditor() {
    if (!draftDirty) {
      setConfirmDiscard(false);
      setEditing(false);
      return;
    }
    setConfirmDiscard(true);
  }

  if (!hostReady) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <HostPinModal open onSuccess={() => setHostReady(true)} />
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
    phase === "reveal" &&
    !adminState.tiebreak &&
    adminState.questionIndex + 1 < adminState.questionCount;
  const answeredCount = adminState.answeredTeamIds.length;
  const teamCount = adminState.teams.length;
  const connectedCount = adminState.connectedTeamIds?.length ?? 0;
  const liveControls =
    phase === "question" || phase === "locked" || phase === "reveal";
  const regularDone =
    adminState.questionIndex >= 0 &&
    adminState.questionIndex + 1 >= adminState.questionCount;
  const firstPlaceTied = tiedLeaders(adminState.teams).length >= 2;
  const offerTiebreak =
    !adminState.tiebreak &&
    regularDone &&
    firstPlaceTied &&
    Boolean(adminState.spareQuestion) &&
    (phase === "reveal" || phase === "lobby");
  const showFinal =
    phase === "reveal" && regularDone && !offerTiebreak;
  const nextQuestionNumber = adminState.questionIndex + 2;
  const questionTotal = editing
    ? draftQuestions.length
    : adminState.questionCount;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {hostCrumbs}
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="font-display text-3xl">{adminState.title}</h1>
            <p className="font-code text-4xl text-[var(--accent)]">{adminState.code}</p>
            <p className="text-sm uppercase tracking-[0.16em] text-[var(--accent)]">
              {phaseLabel(phase, t)}
            </p>
          </div>
          <p className="text-sm text-[var(--muted)]">
            {teamCount === 1
              ? t("admin.teamOne", { count: teamCount })
              : t("admin.teamMany", { count: teamCount })}
            {teamCount > 0
              ? t("admin.connected", { count: connectedCount })
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {displayUrl && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                window.open(displayUrl, "antesala-tv", "noopener,noreferrer")
              }
            >
              {t("admin.openTv")}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() =>
              setShowScores(!adminState.showScores).catch(() => undefined)
            }
          >
            {adminState.showScores
              ? t("admin.hideScoresOnTv")
              : t("admin.showScoresOnTv")}
          </button>
          {phase !== "finished" && !editing && !confirmEndNight && !confirmRestart && (
            <>
              <button
                type="button"
                className="btn btn-warning"
                disabled={busy}
                onClick={() => {
                  setConfirmEndNight(false);
                  setConfirmRestart(true);
                }}
              >
                {t("admin.restartNight")}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => {
                  setConfirmRestart(false);
                  setConfirmEndNight(true);
                }}
              >
                {t("admin.endNight")}
              </button>
            </>
          )}
        </div>
      </header>
      {confirmEndNight && phase !== "finished" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--line)] px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-[var(--muted)]">
            {t("admin.endConfirm")}
          </p>
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
      )}
      {confirmRestart && phase !== "finished" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--line)] px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-[var(--muted)]">
            {t("admin.restartConfirm")}
          </p>
          <button
            type="button"
            className="btn btn-warning"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              restartNight()
                .then(() => {
                  setConfirmRestart(false);
                  setEditing(false);
                  setConfirmDiscard(false);
                })
                .catch((e) =>
                  setError(e instanceof Error ? e.message : t("admin.couldNotRestart")),
                )
                .finally(() => setBusy(false));
            }}
          >
            {t("admin.yesRestart")}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => setConfirmRestart(false)}
          >
            {t("common.cancel")}
          </button>
        </div>
      )}

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

        {phase === "lobby" && !editing && (
          <div className="card-panel flex w-fit max-w-full flex-wrap items-center gap-4 p-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl">{t("admin.teamsJoined")}</h2>
              {adminState.teams.length === 0 ? (
                <p className="mt-1 text-sm text-[var(--muted)]">{t("admin.noTeams")}</p>
              ) : (
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  {adminState.teams.map((team) => (
                    <li key={team.id} className="truncate text-lg font-semibold">
                      {team.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {!regularDone && (
              <button
                type="button"
                className={teamCount > 0 ? "btn btn-primary" : "btn btn-ghost"}
                disabled={busy}
                onClick={() => {
                  handleStart().catch(() => undefined);
                }}
              >
                {t("admin.startQuestionOf", {
                  n: nextQuestionNumber,
                  total: questionTotal,
                })}
              </button>
            )}
            {offerTiebreak && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  startTiebreak().catch((e) =>
                    setError(
                      e instanceof Error ? e.message : t("admin.couldNotRestart"),
                    ),
                  )
                }
              >
                {t("admin.runTiebreak")}
              </button>
            )}
          </div>
        )}

        {liveControls && (
        <div className="card-panel flex flex-wrap items-center gap-3 p-4 ring-1 ring-[var(--accent)]">
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
          {liveControls && !confirmStop && (
            <button
              type="button"
              className="btn btn-warning"
              disabled={busy}
              onClick={() => setConfirmStop(true)}
            >
              {t("admin.stopAndEdit")}
            </button>
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
          {moreAfterReveal && !adminState.tiebreak && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => nextQuestion().catch(() => undefined)}
            >
              {t("admin.nextQuestion")}
            </button>
          )}
          {offerTiebreak && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                startTiebreak().catch((e) =>
                  setError(e instanceof Error ? e.message : t("admin.couldNotRestart")),
                )
              }
            >
              {t("admin.runTiebreak")}
            </button>
          )}
          {showFinal && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => nextQuestion().catch(() => undefined)}
            >
              {t("admin.finalLeaderboard")}
            </button>
          )}
          {showFinal && firstPlaceTied && (
            <p className="text-sm text-[var(--muted)]">{t("admin.stillTied")}</p>
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
              {adminState.tiebreak
                ? t("admin.tiebreaker")
                : `Q${adminState.questionIndex + 1}/${adminState.questionCount}`}
            </span>
          </div>
        </div>
        )}

        {confirmStop && liveControls && (
          <div className="card-panel space-y-3 p-4">
            <p className="text-sm text-[var(--muted)]">{t("admin.stopConfirm")}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  returnToLobby()
                    .then(() => {
                      setConfirmStop(false);
                      setDraftQuestions(
                        adminState.questions.length
                          ? adminState.questions
                          : [blankQuestion()],
                      );
                      setDraftSpare(adminState.spareQuestion ?? blankQuestion());
                      setDraftTimeLimit(adminState.timeLimitSec || 30);
                      setQuestionsOpen(true);
                      setEditing(true);
                    })
                    .catch(() => undefined)
                    .finally(() => setBusy(false));
                }}
              >
                {t("admin.yesStop")}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => setConfirmStop(false)}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        )}

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
                  {adminState.tiebreak
                    ? t("admin.tiebreaker")
                    : t("admin.questionN", { n: adminState.questionIndex + 1 })}
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

        <div className="card-panel p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
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
            <div className="flex flex-wrap items-center gap-2">
              {!editing && (
                <p className="text-sm text-[var(--muted)]">
                  {t("admin.answerTime", { sec: adminState.timeLimitSec })}
                </p>
              )}
            {phase !== "finished" && questionsOpen && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  if (editing) {
                    requestCloseEditor();
                    return;
                  }
                  setDraftQuestions(
                    adminState.questions.length
                      ? adminState.questions
                      : [blankQuestion()],
                  );
                  setDraftSpare(adminState.spareQuestion ?? blankQuestion());
                  setDraftTimeLimit(adminState.timeLimitSec || 30);
                  setConfirmDiscard(false);
                  setEditing(true);
                }}
              >
                {editing ? t("admin.closeEditor") : t("admin.edit")}
              </button>
            )}
            </div>
          </div>
          {confirmDiscard && editing && (
            <div
              className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 ring-1 ring-[var(--warning)]"
              role="alertdialog"
              aria-labelledby="discard-edits-title"
            >
              <p id="discard-edits-title" className="min-w-0 flex-1 text-sm">
                {t("admin.discardEdits")}
              </p>
              <button
                type="button"
                className="btn btn-warning"
                onClick={() => {
                  setConfirmDiscard(false);
                  setEditing(false);
                }}
              >
                {t("admin.discardChanges")}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDiscard(false)}
              >
                {t("common.cancel")}
              </button>
            </div>
          )}
          {questionsOpen &&
            (!editing ? (
              <div>
                <ol className="grid gap-x-8 gap-y-1 text-sm text-[var(--muted)] sm:grid-cols-2">
                  {adminState.questions.map((item, idx) => (
                    <li key={item.id} className="min-w-0">
                      {idx + 1}. {item.text}
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-sm text-[var(--muted)]">
                  {adminState.spareQuestion
                    ? t("admin.spareReady", { text: adminState.spareQuestion.text })
                    : t("admin.noTiebreaker")}
                </p>
              </div>
            ) : (
              <QuestionEditor
                questions={draftQuestions}
                timeLimitSec={draftTimeLimit}
                busy={busy}
                initialIndex={Math.min(
                  Math.max(0, adminState.questionIndex + 1),
                  Math.max(0, draftQuestions.length - 1),
                )}
                lockedThrough={adminState.questionIndex}
                onChange={setDraftQuestions}
                onTimeLimit={setDraftTimeLimit}
                onSave={saveQuestions}
                spare={draftSpare}
                onSpare={setDraftSpare}
              />
            ))}
          {editing && phase === "lobby" && (
            <button
              type="button"
              className="btn btn-ghost mt-4"
              disabled={busy}
              onClick={() => {
                handleStart().catch(() => undefined);
              }}
            >
              {draftDirty
                ? t("admin.saveAndStart", {
                    n: nextQuestionNumber,
                    total: questionTotal,
                  })
                : t("admin.startQuestionOf", {
                    n: nextQuestionNumber,
                    total: questionTotal,
                  })}
            </button>
          )}
        </div>

      {teamCount > 0 && (
      <aside className="card-panel p-4">
          <h3 className="font-display mb-3 text-xl">{t("admin.lobbyScores")}</h3>
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
      </aside>
      )}
    </main>
  );
}

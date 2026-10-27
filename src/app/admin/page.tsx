"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HostBreadcrumbs } from "@/components/HostBreadcrumbs";
import { HostHome } from "@/components/HostHome";
import { HostPinModal } from "@/components/HostPinModal";
import { QuestionEditor } from "@/components/QuestionEditor";
import { useLocale } from "@/components/LocaleProvider";
import { TimerRing } from "@/components/TimerRing";
import { SAMPLE_QUESTIONS } from "@/lib/game/sampleQuestions";
import { firstPlace } from "@/lib/game/tiebreak";
import { hasTopicRounds, nextTopicName, topicBlocks, topicProgress } from "@/lib/game/topics";
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
    case "topic":
      return t("admin.phaseTopic");
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
    if (adminState.phase === "lobby" || adminState.phase === "topic") {
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
    setError(null);
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

  async function handleCreate(input: {
    scheduledDate: string;
    useSample: boolean;
  }) {
    setBusy(true);
    setError(null);
    try {
      await createGame({
        scheduledDate: input.scheduledDate,
        expectedTeams: 64,
        questions: input.useSample
          ? SAMPLE_QUESTIONS.map((q) => ({
              ...q,
              id: crypto.randomUUID(),
            }))
          : [blankQuestion()],
      });
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
      const ready = editing ? draftQuestions : (adminState?.questions ?? []);
      const complete =
        ready.length > 0 &&
        ready.every(
          (question) =>
            question.text.trim() &&
            question.options.every((option) => option.trim()),
        );
      if (!complete) {
        setDraftQuestions(ready.length ? ready : [blankQuestion()]);
        setDraftSpare(adminState?.spareQuestion ?? blankQuestion());
        setDraftTimeLimit(adminState?.timeLimitSec || 30);
        setQuestionsOpen(true);
        setConfirmDiscard(false);
        setEditing(true);
        setError(t("admin.finishQuestions"));
        return;
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
        <HostHome
          connected={connected}
          busy={busy}
          error={error}
          breadcrumbs={hostCrumbs}
          adminState={adminState}
          onCreate={handleCreate}
          onResumeNight={handleResumeNight}
          onDeleteNight={handleDeleteNight}
          onLoadHistory={handleLoadHistory}
        />
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
  const winners = firstPlace(adminState.teams);
  const firstPlaceTied = winners.length >= 2;
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
  const upcomingTopicName = nextTopicName(
    adminState.questions,
    adminState.questionIndex,
  );
  const openingTopic = upcomingTopicName !== null;
  const resumeTopic =
    phase === "lobby" && adminState.questionIndex >= 0
      ? topicProgress(adminState.questions, adminState.questionIndex + 1)
      : null;
  const resumeAtTopicStart = resumeTopic?.number === 1;
  const topicLine =
    adminState.topic && adminState.topic.number > 0
      ? t("admin.topicProgress", {
          name: adminState.topic.name.trim() || t("admin.topicFallback"),
          n: adminState.topic.number,
          total: adminState.topic.total,
        })
      : null;
  const groupedQuestions =
    hasTopicRounds(adminState.questions) ||
    adminState.questions.some((item) => (item.topic ?? "").trim());

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
      <header>
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
          {teamCount > 0 ? t("admin.connected", { count: connectedCount }) : ""}
        </p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,22rem)]">
        <div className="flex min-w-0 flex-col gap-6">
      {confirmEndNight && phase !== "finished" && (
        <div className="card-panel flex flex-wrap items-center gap-3 p-4 lg:hidden">
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
        <div className="card-panel flex flex-wrap items-center gap-3 p-4 lg:hidden">
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
          <div className="card-panel flex flex-col gap-4 p-5">
            <div className="min-w-0">
              <h2 className="font-display text-2xl">{t("admin.teamsJoined")}</h2>
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
              <>
                {resumeAtTopicStart && resumeTopic && (
                  <h2 className="font-display text-4xl leading-none">
                    {resumeTopic.name.trim() || t("admin.topicFallback")}
                  </h2>
                )}
                <button
                  type="button"
                  className={
                    teamCount > 0 ? "btn btn-primary self-start" : "btn btn-ghost self-start"
                  }
                  disabled={busy}
                  onClick={() => {
                    handleStart().catch(() => undefined);
                  }}
                >
                  {resumeAtTopicStart && resumeTopic
                    ? t("admin.startQuestionOf", { n: 1, total: resumeTopic.total })
                    : t("admin.startQuestionOf", {
                        n: nextQuestionNumber,
                        total: questionTotal,
                      })}
                </button>
              </>
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

        {phase === "topic" && adminState.topic && (
          <div className="card-panel flex flex-col gap-4 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              {t("admin.phaseTopic")}
            </p>
            <h2 className="font-display text-5xl leading-none">
              {adminState.topic.name.trim() || t("admin.topicFallback")}
            </h2>
            <p className="text-[var(--muted)]">{t("admin.topicReady")}</p>
            <button
              type="button"
              className="btn btn-primary self-start"
              disabled={busy}
              onClick={() => {
                handleStart().catch(() => undefined);
              }}
            >
              {t("admin.startQuestionOf", {
                n: 1,
                total: adminState.topic.total,
              })}
            </button>
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
              {openingTopic
                ? t("admin.openTopic", {
                    name:
                      (upcomingTopicName ?? "").trim() || t("admin.topicFallback"),
                  })
                : t("admin.nextQuestion")}
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
                : topicLine ??
                  `Q${adminState.questionIndex + 1}/${adminState.questionCount}`}
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
                    : topicLine ??
                      t("admin.questionN", { n: adminState.questionIndex + 1 })}
                  {phase === "locked"
                    ? t("admin.questionLocked")
                    : adminState.timerPaused
                      ? t("admin.clockPaused")
                      : ""}
                </p>
                <h2 className="font-display text-2xl leading-tight">{q.text}</h2>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
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
            {winners.length > 0 && (
              <p className="font-display text-2xl">
                {winners.length === 1
                  ? t("admin.winnerLine", {
                      name: winners[0].name,
                      score: winners[0].score,
                    })
                  : t("admin.tieLine", {
                      names: winners.map((team) => team.name).join(", "),
                      score: winners[0].score,
                    })}
              </p>
            )}
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

        </div>
        <aside className="flex flex-col gap-6">
          <section className="card-panel flex flex-col gap-3 p-5">
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
            <button
              type="button"
              role="switch"
              aria-checked={adminState.showScores}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-left font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={busy}
              onClick={() =>
                setShowScores(!adminState.showScores).catch(() => undefined)
              }
            >
              <span>{t("admin.scoresOnTv")}</span>
              <span
                aria-hidden
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                  adminState.showScores
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--bg)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full transition-transform ${
                    adminState.showScores
                      ? "translate-x-5 bg-[var(--navy)]"
                      : "bg-[var(--muted)]"
                  }`}
                />
              </span>
            </button>
            {phase !== "finished" && !editing && !confirmEndNight && !confirmRestart && (
              <div className="grid grid-cols-2 gap-2">
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
              </div>
            )}
            {confirmEndNight && phase !== "finished" && (
              <div className="hidden flex-col gap-3 lg:flex">
                <p className="text-sm text-[var(--muted)]">{t("admin.endConfirm")}</p>
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
            {confirmRestart && phase !== "finished" && (
              <div className="hidden flex-col gap-3 lg:flex">
                <p className="text-sm text-[var(--muted)]">{t("admin.restartConfirm")}</p>
                <div className="flex flex-wrap gap-2">
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
                          setError(
                            e instanceof Error ? e.message : t("admin.couldNotRestart"),
                          ),
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
              </div>
            )}
          </section>
          {adminState.teams.length > 0 && (
          <section className="card-panel p-5">
            <h2 className="font-display mb-3 text-2xl">{t("admin.lobbyScores")}</h2>
              <ul className="space-y-3">
                {adminState.teams.map((team, index) => {
                  const isConnected = adminState.connectedTeamIds?.includes(team.id);
                  return (
                    <li
                      key={team.id}
                      className="rounded-xl bg-[var(--surface-2)] px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            <span className="mr-2 text-[var(--muted)]">{index + 1}.</span>
                            {team.name}
                          </p>
                          <p
                            className={`mt-1 text-xs ${
                              isConnected ? "text-[var(--accent)]" : "text-[var(--muted)]"
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
                          onClick={() => kickTeam(team.id).catch(() => undefined)}
                        >
                          {t("admin.kick")}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
          </section>
          )}
        </aside>
      </div>

        <div className="card-panel p-5">
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
                {groupedQuestions ? (
                  <div className="space-y-4">
                    {topicBlocks(adminState.questions).map((block) => (
                      <div key={block.start}>
                        <h3 className="font-display text-xl">
                          {block.name.trim() || t("admin.topicFallback")}
                        </h3>
                        <ol className="mt-1 grid gap-y-1 text-sm text-[var(--muted)]">
                          {adminState.questions
                            .slice(block.start, block.end)
                            .map((item, offset) => (
                              <li key={item.id} className="min-w-0">
                                {block.start + offset + 1}. {item.text}
                              </li>
                            ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ol className="grid gap-x-8 gap-y-1 text-sm text-[var(--muted)] sm:grid-cols-2">
                    {adminState.questions.map((item, idx) => (
                      <li key={item.id} className="min-w-0">
                        {idx + 1}. {item.text}
                      </li>
                    ))}
                  </ol>
                )}
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
    </main>
  );
}

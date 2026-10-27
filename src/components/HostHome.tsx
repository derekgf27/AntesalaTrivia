"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { PastNightsCalendar } from "@/components/PastNightsCalendar";
import { titleFromScheduledDate, toDateInputValue } from "@/lib/game/dateUtils";
import { SAMPLE_QUESTIONS } from "@/lib/game/sampleQuestions";
import { firstPlace } from "@/lib/game/tiebreak";
import type { AdminGameState, NightRecord, Team } from "@/lib/game/types";

function phaseText(
  phase: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
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

function winnerText(
  teams: Team[],
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const winners = firstPlace(teams);
  if (winners.length === 0) return null;
  if (winners.length === 1) {
    return t("admin.winnerLine", {
      name: winners[0].name,
      score: winners[0].score,
    });
  }
  return t("admin.tieLine", {
    names: winners.map((team) => team.name).join(", "),
    score: winners[0].score,
  });
}

function isOpen(night: { phase: string; finishedAt?: string | null }) {
  return night.phase !== "finished" && !night.finishedAt;
}

export function HostHome({
  connected,
  busy,
  error,
  breadcrumbs,
  adminState,
  onCreate,
  onResumeNight,
  onDeleteNight,
  onLoadHistory,
}: {
  connected: boolean;
  busy: boolean;
  error: string | null;
  breadcrumbs?: ReactNode;
  adminState: AdminGameState | null;
  onCreate: (input: { scheduledDate: string; useSample: boolean }) => Promise<void>;
  onResumeNight: (code: string) => Promise<void>;
  onDeleteNight?: (nightId: string) => Promise<void>;
  onLoadHistory: (query: string) => Promise<{
    nights: NightRecord[];
    hasCurrent: boolean;
    currentCode: string | null;
    currentTitle: string | null;
  }>;
}) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const dateRef = useRef<HTMLInputElement>(null);
  const [scheduledDate, setScheduledDate] = useState(toDateInputValue);
  const [useSample, setUseSample] = useState(false);
  const [nights, setNights] = useState<NightRecord[]>([]);
  const [hasCurrent, setHasCurrent] = useState(false);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    onLoadHistory("")
      .then((res) => {
        if (cancelled) return;
        setNights(res.nights);
        setHasCurrent(res.hasCurrent);
        setCurrentCode(res.currentCode);
        setCurrentTitle(res.currentTitle);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLocalError(t("hostModal.couldNotLoadHistory"));
      });
    return () => {
      cancelled = true;
    };
  }, [connected, onLoadHistory, t]);

  const featured = featuredNight(adminState, nights, currentCode);
  const featuredOpen = featured ? isOpen(featured) : false;
  const featuredWinner =
    featured && !featuredOpen ? winnerText(featured.teams, t) : null;
  const previewTitle = titleFromScheduledDate(scheduledDate, locale);
  const shownError = error || localError;

  function focusStart() {
    document.getElementById("start-night")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    dateRef.current?.focus();
  }

  function submitCreate() {
    if (hasCurrent && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    onCreate({ scheduledDate, useSample }).finally(() => setConfirmReplace(false));
  }

  async function refreshHistory() {
    const res = await onLoadHistory("");
    setNights(res.nights);
    setHasCurrent(res.hasCurrent);
    setCurrentCode(res.currentCode);
    setCurrentTitle(res.currentTitle);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-6 py-8 lg:px-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        {breadcrumbs ? <div>{breadcrumbs}</div> : <span />}
        <button
          type="button"
          className="btn btn-ghost py-2 text-sm"
          onClick={() => router.push("/")}
        >
          {t("common.mainMenu")}
        </button>
      </header>

      <div className="grid items-stretch gap-8 lg:grid-cols-2">
      {featured && (
        <section className="card-panel h-full space-y-4 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            {t("hostHome.tonight")}
          </p>
          <div>
            <h1 className="font-display text-3xl">{featured.title}</h1>
            <p className="font-code mt-1 text-4xl text-[var(--accent)]">{featured.code}</p>
          </div>
          {featuredOpen ? (
            <>
              <p className="text-sm text-[var(--muted)]">
                {phaseText(featured.phase, t)}
                {" · "}
                {featured.teams.length === 1
                  ? t("admin.teamOne", { count: featured.teams.length })
                  : t("admin.teamMany", { count: featured.teams.length })}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !connected}
                  onClick={() => {
                    onResumeNight(featured.code).catch(() => {
                      setLocalError(t("hostModal.couldNotResume"));
                    });
                  }}
                >
                  {t("hostHome.continueTonight")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    window.open(
                      `/display?code=${featured.code}`,
                      "antesala-tv",
                      "noopener,noreferrer",
                    )
                  }
                >
                  {t("admin.openTv")}
                </button>
              </div>
            </>
          ) : (
            <>
              {featuredWinner && (
                <p className="font-display text-4xl">{featuredWinner}</p>
              )}
              <p className="text-[var(--muted)]">{t("hostHome.nightOver")}</p>
              <button type="button" className="btn btn-ghost" onClick={focusStart}>
                {t("hostHome.startAnother")}
              </button>
            </>
          )}
        </section>
      )}

      <section
        id="start-night"
        className={`card-panel h-full space-y-5 p-5 ${featured ? "" : "lg:col-span-2"}`}
      >
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            {t("hostHome.startNight")}
          </p>
          <h2 className="font-display mt-2 text-3xl">{previewTitle}</h2>
        </div>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            submitCreate();
          }}
        >
          <label className="block max-w-xs space-y-2">
            <span className="block text-sm text-[var(--muted)]">{t("hostModal.nightDate")}</span>
            <input
              ref={dateRef}
              id="night-date"
              className="input block w-full"
              type="date"
              value={scheduledDate}
              onChange={(e) => {
                setScheduledDate(e.target.value);
                setConfirmReplace(false);
              }}
              required
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={!useSample}
              className={`rounded-2xl px-4 py-4 text-left ring-1 ${
                !useSample
                  ? "bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]"
                  : "bg-[var(--surface-2)] ring-[var(--line)]"
              }`}
              onClick={() => {
                setUseSample(false);
                setConfirmReplace(false);
              }}
            >
              <span className="font-semibold">{t("hostHome.blankQuestions")}</span>
              <span className="mt-1 block text-sm text-[var(--muted)]">
                {t("hostHome.blankHint")}
              </span>
            </button>
            <button
              type="button"
              aria-pressed={useSample}
              className={`rounded-2xl px-4 py-4 text-left ring-1 ${
                useSample
                  ? "bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]"
                  : "bg-[var(--surface-2)] ring-[var(--line)]"
              }`}
              onClick={() => {
                setUseSample(true);
                setConfirmReplace(false);
              }}
            >
              <span className="font-semibold">{t("hostHome.sampleSet")}</span>
              <span className="mt-1 block text-sm text-[var(--muted)]">
                {t("hostHome.sampleHint", { count: SAMPLE_QUESTIONS.length })}
              </span>
            </button>
          </div>

          {hasCurrent && (
            <p className="danger-soft-panel rounded-xl px-4 py-3 text-sm text-[var(--danger)]">
              {t("hostModal.unfinishedWarning", { title: currentTitle ?? "" })}
            </p>
          )}
          {confirmReplace && (
            <p className="text-sm text-[var(--accent)]">{t("hostModal.confirmReplace")}</p>
          )}
          {shownError && <p className="text-sm text-[var(--danger)]">{shownError}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !connected || !scheduledDate}
          >
            {confirmReplace ? t("hostModal.confirmCreate") : t("hostModal.createNight")}
          </button>
        </form>
      </section>
      </div>

      <section className="card-panel space-y-4 p-5">
        <h2 className="font-display text-2xl">{t("hostHome.earlier")}</h2>
        {!loaded && connected && (
          <p className="text-sm text-[var(--muted)]">{t("common.loading")}</p>
        )}
        {loaded && (
          <PastNightsCalendar
            nights={nights}
            busy={busy}
            onResumeNight={(code) => {
              onResumeNight(code).catch(() => {
                setLocalError(t("hostModal.couldNotResume"));
              });
            }}
            onDeleteNight={
              onDeleteNight
                ? async (nightId) => {
                    try {
                      await onDeleteNight(nightId);
                      await refreshHistory();
                      setLocalError(null);
                    } catch {
                      setLocalError(t("hostModal.couldNotDelete"));
                    }
                  }
                : undefined
            }
          />
        )}
      </section>
    </main>
  );
}

function featuredNight(
  adminState: AdminGameState | null,
  nights: NightRecord[],
  currentCode: string | null,
): { code: string; title: string; phase: string; teams: Team[]; finishedAt?: string | null } | null {
  if (adminState) {
    return {
      code: adminState.code,
      title: adminState.title,
      phase: adminState.phase,
      teams: adminState.teams,
    };
  }
  if (currentCode) {
    const live = nights.find(
      (night) => night.code.toUpperCase() === currentCode.toUpperCase(),
    );
    if (live) return live;
  }
  return nights[0] ?? null;
}

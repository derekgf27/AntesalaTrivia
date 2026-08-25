"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "@/components/LocaleProvider";
import type { NightRecord } from "@/lib/game/types";
import { SAMPLE_QUESTIONS } from "@/lib/game/sampleQuestions";
import { titleFromScheduledDate, toDateInputValue } from "@/lib/game/dateUtils";
import { PastNightsCalendar } from "@/components/PastNightsCalendar";

type Tab = "create" | "resume" | "history";

export function HostNightModal({
  open,
  connected,
  busy,
  error,
  breadcrumbs,
  onCreate,
  onResume,
  onResumeNight,
  onDeleteNight,
  onLoadHistory,
}: {
  open: boolean;
  connected: boolean;
  busy: boolean;
  error: string | null;
  breadcrumbs?: ReactNode;
  onCreate: (input: { scheduledDate: string }) => Promise<void>;
  onResume: () => Promise<void>;
  onResumeNight?: (code: string) => Promise<void>;
  onDeleteNight?: (nightId: string) => Promise<void>;
  onLoadHistory: (query: string) => Promise<{
    nights: NightRecord[];
    hasCurrent: boolean;
    currentTitle: string | null;
  }>;
}) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [tab, setTab] = useState<Tab>("create");
  const [scheduledDate, setScheduledDate] = useState(toDateInputValue);
  const [nights, setNights] = useState<NightRecord[]>([]);
  const [hasCurrent, setHasCurrent] = useState(false);
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const tabs: { id: Tab; label: string }[] = [
    { id: "create", label: t("hostModal.create") },
    { id: "resume", label: t("hostModal.resume") },
    { id: "history", label: t("hostModal.pastNights") },
  ];

  useEffect(() => {
    if (!open || !connected) return;
    onLoadHistory("")
      .then((res) => {
        setHasCurrent(res.hasCurrent);
        setCurrentTitle(res.currentTitle);
      })
      .catch(() => undefined);
  }, [open, connected, onLoadHistory]);

  useEffect(() => {
    if (!open || tab !== "history" || !connected) return;
    onLoadHistory("")
      .then((res) => {
        setNights(res.nights);
        setHasCurrent(res.hasCurrent);
        setCurrentTitle(res.currentTitle);
        setLocalError(null);
      })
      .catch(() => {
        setLocalError(t("hostModal.couldNotLoadHistory"));
      });
  }, [open, tab, connected, onLoadHistory, t]);

  if (!open) return null;

  const previewTitle = titleFromScheduledDate(scheduledDate, locale);

  function submitCreate() {
    if (hasCurrent && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    onCreate({ scheduledDate }).finally(() => setConfirmReplace(false));
  }

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="host-night-title"
        className="card-panel flex h-[min(640px,90dvh)] w-full max-w-4xl flex-col overflow-hidden shadow-2xl"
      >
        <div className="shrink-0 border-b border-[var(--line)] px-6 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            {breadcrumbs ? <div>{breadcrumbs}</div> : <span />}
            <button
              type="button"
              className="btn btn-ghost py-2 text-sm"
              onClick={() => router.push("/")}
            >
              {t("common.mainMenu")}
            </button>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            {t("home.brand")}
          </p>
          <h2 id="host-night-title" className="font-display mt-1 text-3xl">
            {t("hostModal.title")}
          </h2>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-[var(--line)] px-4 pt-2">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold ${
                tab === id
                  ? "bg-[var(--surface-2)] text-[var(--text)]"
                  : "text-[var(--muted)]"
              }`}
              onClick={() => {
                setTab(id);
                setConfirmReplace(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
          {tab === "create" && (
            <form
              className="mx-auto flex h-full max-w-lg flex-col justify-center gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                submitCreate();
              }}
            >
              <label className="space-y-2">
                <span className="text-sm text-[var(--muted)]">
                  {t("hostModal.nightDate")}
                </span>
                <input
                  className="input"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => {
                    setScheduledDate(e.target.value);
                    setConfirmReplace(false);
                  }}
                  required
                  autoFocus
                />
              </label>
              <p className="text-sm text-[var(--text)]">{previewTitle}</p>
              <p className="text-sm text-[var(--muted)]">
                {t("hostModal.createHint", { count: SAMPLE_QUESTIONS.length })}
              </p>
              {hasCurrent && (
                <p className="danger-soft-panel rounded-xl px-4 py-3 text-sm text-[var(--danger)]">
                  {t("hostModal.unfinishedWarning", {
                    title: currentTitle ?? "",
                  })}
                </p>
              )}
              {confirmReplace && (
                <p className="text-sm text-[var(--accent)]">
                  {t("hostModal.confirmReplace")}
                </p>
              )}
              {(error || localError) && (
                <p className="text-sm text-[var(--danger)]">{error || localError}</p>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || !connected || !scheduledDate}
              >
                {confirmReplace
                  ? t("hostModal.confirmCreate")
                  : t("hostModal.createNight")}
              </button>
            </form>
          )}

          {tab === "resume" && (
            <form
              className="mx-auto flex h-full max-w-lg flex-col justify-center gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                onResume();
              }}
            >
              {hasCurrent ? (
                <div className="space-y-2">
                  <p className="text-[var(--muted)]">
                    {t("hostModal.resumeReady")}{" "}
                    <span className="font-semibold text-[var(--text)]">
                      {currentTitle}
                    </span>
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {t("hostModal.resumeHint")}
                  </p>
                </div>
              ) : (
                <p className="text-[var(--muted)]">{t("hostModal.noUnfinished")}</p>
              )}
              {(error || localError) && (
                <p className="text-sm text-[var(--danger)]">{error || localError}</p>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || !connected || !hasCurrent}
              >
                {t("hostModal.enterNight")}
              </button>
            </form>
          )}

          {tab === "history" && (
            <div className="flex h-full min-h-0 flex-col gap-3">
              {(error || localError) && (
                <p className="shrink-0 text-sm text-[var(--danger)]">
                  {error || localError}
                </p>
              )}
              <div className="min-h-0 flex-1 overflow-hidden">
                <PastNightsCalendar
                  nights={nights}
                  busy={busy}
                  onResumeNight={
                    onResumeNight
                      ? (code) => {
                          onResumeNight(code).catch(() => {
                            setLocalError(t("hostModal.couldNotResume"));
                          });
                        }
                      : undefined
                  }
                  onDeleteNight={
                    onDeleteNight
                      ? async (nightId) => {
                          try {
                            await onDeleteNight(nightId);
                            const res = await onLoadHistory("");
                            setNights(res.nights);
                            setHasCurrent(res.hasCurrent);
                            setCurrentTitle(res.currentTitle);
                            setLocalError(null);
                          } catch {
                            setLocalError(t("hostModal.couldNotDelete"));
                          }
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

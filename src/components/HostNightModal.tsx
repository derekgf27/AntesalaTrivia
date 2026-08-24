"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  onLoadHistory: (query: string) => Promise<{
    nights: NightRecord[];
    hasCurrent: boolean;
    currentTitle: string | null;
  }>;
}) {
  const [tab, setTab] = useState<Tab>("create");
  const [scheduledDate, setScheduledDate] = useState(toDateInputValue);
  const [nights, setNights] = useState<NightRecord[]>([]);
  const [hasCurrent, setHasCurrent] = useState(false);
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  useEffect(() => {
    if (!open || !connected) return;
    onLoadHistory("")
      .then((res) => {
        setHasCurrent(res.hasCurrent);
        setCurrentTitle(res.currentTitle);
        if (res.hasCurrent) setTab("resume");
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
      .catch((err: unknown) => {
        setLocalError(err instanceof Error ? err.message : "Could not load history");
      });
  }, [open, tab, connected, onLoadHistory]);

  if (!open) return null;

  const previewTitle = titleFromScheduledDate(scheduledDate);

  function submitCreate() {
    if (hasCurrent && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    onCreate({ scheduledDate }).finally(() => setConfirmReplace(false));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="host-night-title"
        className="card-panel flex h-[min(640px,90dvh)] w-full max-w-4xl flex-col overflow-hidden shadow-2xl"
      >
        <div className="shrink-0 border-b border-[var(--line)] px-6 py-4">
          {breadcrumbs ? <div className="mb-3">{breadcrumbs}</div> : null}
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
            La Antesala
          </p>
          <h2 id="host-night-title" className="font-display mt-1 text-3xl">
            Set up the night
          </h2>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-[var(--line)] px-4 pt-2">
          {(
            [
              ["create", "Create"],
              ["resume", "Resume"],
              ["history", "Past nights"],
            ] as const
          ).map(([id, label]) => (
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
                <span className="text-sm text-[var(--muted)]">Trivia night date</span>
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
                Pick the night you&apos;re hosting (or prep for). Starts with{" "}
                {SAMPLE_QUESTIONS.length} sample questions — edit them in the lobby
                before guests arrive.
              </p>
              {hasCurrent && (
                <p className="rounded-xl bg-[rgba(255,107,74,0.12)] px-4 py-3 text-sm text-[var(--danger)]">
                  There&apos;s already an unfinished night
                  {currentTitle ? ` (${currentTitle})` : ""}. Creating a new one
                  replaces it as the live night.
                </p>
              )}
              {confirmReplace && (
                <p className="text-sm text-[var(--accent)]">
                  Tap Create again to confirm and replace the unfinished night.
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
                {confirmReplace ? "Yes, create new night" : "Create trivia night"}
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
                    Unfinished night ready to reopen:{" "}
                    <span className="font-semibold text-[var(--text)]">
                      {currentTitle}
                    </span>
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    Includes nights that were still open when the server last
                    restarted.
                  </p>
                </div>
              ) : (
                <p className="text-[var(--muted)]">
                  No unfinished night found. Create one instead, or check Past
                  nights.
                </p>
              )}
              {(error || localError) && (
                <p className="text-sm text-[var(--danger)]">{error || localError}</p>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || !connected || !hasCurrent}
              >
                Enter current night
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
                  onResumeNight={
                    onResumeNight
                      ? (code) => {
                          onResumeNight(code).catch((err: unknown) => {
                            setLocalError(
                              err instanceof Error
                                ? err.message
                                : "Could not resume night",
                            );
                          });
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

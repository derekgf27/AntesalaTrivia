"use client";

import { useMemo, useState } from "react";
import type { NightRecord } from "@/lib/game/types";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function PastNightsCalendar({
  nights,
  onResumeNight,
}: {
  nights: NightRecord[];
  onResumeNight?: (code: string) => void;
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | null>(new Date());

  const nightsByDay = useMemo(() => {
    const map = new Map<string, NightRecord[]>();
    for (const night of nights) {
      const key = night.scheduledDate || night.createdAt.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(night);
      map.set(key, list);
    }
    return map;
  }, [nights]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = startOfMonth(cursor);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const total = Math.ceil((startPad + daysInMonth) / 7) * 7;
    const out: { date: Date; inMonth: boolean }[] = [];

    for (let i = 0; i < total; i++) {
      const dayNum = i - startPad + 1;
      const date = new Date(year, month, dayNum);
      out.push({ date, inMonth: dayNum >= 1 && dayNum <= daysInMonth });
    }
    return out;
  }, [cursor]);

  const selectedNights = selected
    ? nightsByDay.get(dateKey(selected)) ?? []
    : [];

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const today = new Date();

  return (
    <div className="grid h-full min-h-0 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <button
            type="button"
            className="btn btn-ghost px-3 py-2"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
            }
            aria-label="Previous month"
          >
            ←
          </button>
          <h3 className="font-display text-xl">{monthLabel}</h3>
          <button
            type="button"
            className="btn btn-ghost px-3 py-2"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
            }
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--muted)]">
          {WEEKDAYS.map((d, i) => (
            <div key={`${d}-${i}`} className="py-1 font-semibold">
              {d}
            </div>
          ))}
          {cells.map(({ date, inMonth }) => {
            const key = dateKey(date);
            const dayNights = nightsByDay.get(key) ?? [];
            const hasNights = dayNights.length > 0;
            const isSelected = selected ? sameDay(date, selected) : false;
            const isToday = sameDay(date, today);

            return (
              <button
                key={key + String(inMonth)}
                type="button"
                disabled={!inMonth}
                onClick={() => setSelected(date)}
                className={`relative flex h-10 flex-col items-center justify-center rounded-lg text-sm transition sm:h-11 ${
                  !inMonth
                    ? "opacity-20"
                    : isSelected
                      ? "bg-[var(--accent)] text-[var(--navy)]"
                      : hasNights
                        ? "bg-[var(--accent-soft)] text-[var(--text)] hover:ring-1 hover:ring-[var(--accent)]"
                        : "text-[var(--muted)] hover:bg-[var(--surface-2)]"
                } ${isToday && !isSelected ? "ring-1 ring-[var(--line)]" : ""}`}
              >
                <span className="font-semibold">{date.getDate()}</span>
                {hasNights && (
                  <span
                    className={`absolute bottom-1 h-1 w-1 rounded-full ${
                      isSelected ? "bg-[var(--navy)]" : "bg-[var(--accent)]"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-col rounded-xl bg-[var(--surface-2)] p-4">
        <p className="mb-3 shrink-0 text-xs uppercase tracking-[0.15em] text-[var(--muted)]">
          {selected
            ? selected.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Select a day"}
        </p>
        {selectedNights.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No trivia nights this day.</p>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {selectedNights.map((night) => {
              const unfinished =
                !night.finishedAt && night.phase !== "finished";
              return (
                <li key={night.id} className="rounded-lg bg-[var(--surface)] px-3 py-2">
                  <p className="font-semibold">{night.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {new Date(night.createdAt).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    · code {night.code} · {night.teams.length} teams ·{" "}
                    {unfinished ? "in progress" : night.phase}
                  </p>
                  {night.teams[0] && (
                    <p className="mt-1 text-sm text-[var(--accent)]">
                      Top: {night.teams[0].name} ({night.teams[0].score})
                    </p>
                  )}
                  {unfinished && onResumeNight && (
                    <button
                      type="button"
                      className="btn btn-primary mt-3 w-full py-2 text-sm"
                      onClick={() => onResumeNight(night.code)}
                    >
                      Resume this night
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

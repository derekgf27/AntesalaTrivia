"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { parseDateInput } from "@/lib/game/dateUtils";
import { firstPlace } from "@/lib/game/tiebreak";
import { localeTag } from "@/lib/i18n/locale";
import type { NightRecord, Team } from "@/lib/game/types";

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

function nightKey(night: NightRecord) {
  return night.scheduledDate || night.createdAt.slice(0, 10);
}

function isOpenNight(night: NightRecord) {
  return !night.finishedAt && night.phase !== "finished";
}

export function PastNightsCalendar({
  nights,
  busy,
  onResumeNight,
  onDeleteNight,
}: {
  nights: NightRecord[];
  busy?: boolean;
  onResumeNight?: (code: string) => void;
  onDeleteNight?: (nightId: string) => Promise<void> | void;
}) {
  const { locale, t } = useLocale();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const jumped = useRef(false);
  const weekdays = t("pastNights.weekdays").split(",");
  const dateLocale = localeTag(locale);

  useEffect(() => {
    if (jumped.current || nights.length === 0) return;
    jumped.current = true;
    const newest = nights[0];
    const raw = nightKey(newest);
    const parsed = parseDateInput(raw);
    setCursor(startOfMonth(parsed));
    setSelected(parsed);
  }, [nights]);

  const nightsByDay = useMemo(() => {
    const map = new Map<string, NightRecord[]>();
    for (const night of nights) {
      const key = nightKey(night);
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

  const monthPrefix = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
  const monthNights = nights
    .filter((night) => nightKey(night).startsWith(monthPrefix))
    .sort(
      (a, b) =>
        nightKey(b).localeCompare(nightKey(a)) ||
        b.createdAt.localeCompare(a.createdAt),
    );

  const monthLabel = cursor.toLocaleDateString(dateLocale, {
    month: "long",
    year: "numeric",
  });

  const today = new Date();

  function shiftMonth(delta: number) {
    jumped.current = true;
    setConfirmId(null);
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  }

  function pickDay(date: Date) {
    jumped.current = true;
    setSelected(date);
    setConfirmId(null);
    const first = monthNights.find((night) => nightKey(night) === dateKey(date));
    if (!first) return;
    document.getElementById(`night-${first.id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="btn btn-ghost px-3 py-2"
            onClick={() => shiftMonth(-1)}
            aria-label={t("pastNights.prevMonth")}
          >
            ←
          </button>
          <h3 className="font-display text-xl">{monthLabel}</h3>
          <button
            type="button"
            className="btn btn-ghost px-3 py-2"
            onClick={() => shiftMonth(1)}
            aria-label={t("pastNights.nextMonth")}
          >
            →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--muted)]">
          {weekdays.map((d, i) => (
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
                onClick={() => pickDay(date)}
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

      {monthNights.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{t("pastNights.noMonth")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {monthNights.map((night) => (
            <NightRow
              key={night.id}
              night={night}
              selected={selected ? nightKey(night) === dateKey(selected) : false}
              confirming={confirmId === night.id}
              busy={busy}
              dateLocale={dateLocale}
              onOpen={onResumeNight}
              onAskDelete={() => setConfirmId(night.id)}
              onCancelDelete={() => setConfirmId(null)}
              onDelete={onDeleteNight}
            />
          ))}
        </ul>
      )}
    </div>
  );
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

function NightRow({
  night,
  selected,
  confirming,
  busy,
  dateLocale,
  onOpen,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  night: NightRecord;
  selected: boolean;
  confirming: boolean;
  busy?: boolean;
  dateLocale: string;
  onOpen?: (code: string) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete?: (nightId: string) => Promise<void> | void;
}) {
  const { t } = useLocale();
  const open = isOpenNight(night);
  const when = parseDateInput(nightKey(night)).toLocaleDateString(dateLocale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const place = open ? null : winnerText(night.teams, t);

  return (
    <li
      id={`night-${night.id}`}
      className={`rounded-xl bg-[var(--surface-2)] px-4 py-3 ${
        selected ? "ring-1 ring-[var(--accent)]" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{when}</p>
          <p className="font-code text-2xl text-[var(--accent)]">{night.code}</p>
          {open ? (
            <p className="text-sm text-[var(--muted)]">{t("pastNights.inProgress")}</p>
          ) : (
            place && <p className="text-sm text-[var(--accent)]">{place}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {open && onOpen && (
            <button
              type="button"
              className="btn btn-primary py-2 text-sm"
              disabled={busy}
              onClick={() => onOpen(night.code)}
            >
              {t("pastNights.open")}
            </button>
          )}
          {onDelete && !confirming && (
            <button
              type="button"
              className="btn btn-ghost py-2 text-sm text-[var(--danger)]"
              disabled={busy}
              onClick={onAskDelete}
            >
              {t("pastNights.deleteNight")}
            </button>
          )}
        </div>
      </div>
      {confirming && onDelete && (
        <div className="danger-soft-panel mt-3 space-y-2 rounded-lg p-3">
          <p className="text-xs text-[var(--danger)]">
            {t("pastNights.deleteConfirm", {
              live: open ? t("pastNights.deleteLive") : "",
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-danger py-2 text-sm"
              disabled={busy}
              onClick={() => {
                void Promise.resolve(onDelete(night.id)).finally(onCancelDelete);
              }}
            >
              {t("pastNights.yesDelete")}
            </button>
            <button
              type="button"
              className="btn btn-ghost py-2 text-sm"
              disabled={busy}
              onClick={onCancelDelete}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

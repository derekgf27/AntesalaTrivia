"use client";

import { useCountdown } from "@/hooks/useCountdown";

export function TimerRing({
  timerEndsAt,
  pausedRemainingMs = null,
  paused = false,
  totalSec,
  large = false,
  xlarge = false,
}: {
  timerEndsAt: number | null;
  pausedRemainingMs?: number | null;
  paused?: boolean;
  totalSec: number;
  large?: boolean;
  xlarge?: boolean;
}) {
  const { seconds, remainingMs } = useCountdown(timerEndsAt);
  const displayRemaining =
    paused && pausedRemainingMs != null ? pausedRemainingMs : remainingMs;
  const displaySeconds =
    paused && pausedRemainingMs != null
      ? Math.ceil(pausedRemainingMs / 1000)
      : seconds;
  const totalMs = Math.max(1, totalSec * 1000);
  const hasTime = paused
    ? pausedRemainingMs != null
    : Boolean(timerEndsAt);
  const progress = hasTime ? Math.min(1, displayRemaining / totalMs) : 0;
  const urgent = !paused && displaySeconds <= 10 && hasTime;

  const size = xlarge ? 240 : large ? 180 : 96;
  const stroke = xlarge ? 14 : large ? 10 : 7;
  const numberClass = xlarge
    ? "text-7xl lg:text-8xl"
    : large
      ? "text-6xl"
      : "text-3xl";
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${
        urgent ? "animate-pulse" : ""
      }`}
      style={{ width: size, height: size }}
      aria-live="polite"
      aria-label={
        paused
          ? `Timer paused at ${displaySeconds} seconds`
          : `${displaySeconds} seconds remaining`
      }
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={
            paused
              ? "var(--muted)"
              : urgent
                ? "var(--danger)"
                : "var(--accent)"
          }
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-200 ease-linear"
        />
      </svg>
      <span
        className={`absolute font-display tabular-nums tracking-normal ${numberClass} ${
          paused
            ? "text-[var(--muted)]"
            : urgent
              ? "text-[var(--danger)]"
              : ""
        }`}
      >
        {hasTime ? displaySeconds : "—"}
      </span>
    </div>
  );
}

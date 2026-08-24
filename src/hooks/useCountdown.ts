"use client";

import { useEffect, useState } from "react";

export function useCountdown(timerEndsAt: number | null) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!timerEndsAt) {
      setRemainingMs(0);
      return;
    }

    const tick = () => {
      setRemainingMs(Math.max(0, timerEndsAt - Date.now()));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [timerEndsAt]);

  const seconds = Math.ceil(remainingMs / 1000);
  return { remainingMs, seconds };
}

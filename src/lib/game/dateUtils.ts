/** Local YYYY-MM-DD for <input type="date"> */
export function toDateInputValue(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local calendar date (not UTC midnight). */
export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function titleFromScheduledDate(
  scheduledDate: string,
  locale: "en" | "es" = "en",
): string {
  const d = parseDateInput(scheduledDate);
  const formatted = d.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return locale === "es"
    ? `Noche de trivia · ${formatted}`
    : `Trivia Night · ${formatted}`;
}

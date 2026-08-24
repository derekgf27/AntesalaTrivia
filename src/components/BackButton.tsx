"use client";

import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--navy)]/90 px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-lg backdrop-blur-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      aria-label="Go back"
    >
      <span aria-hidden>←</span>
      Back
    </button>
  );
}

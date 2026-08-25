"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLocale();

  if (pathname === "/") return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)]/90 px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-lg backdrop-blur-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      aria-label={t("common.backAria")}
    >
      <span aria-hidden>←</span>
      {t("common.back")}
    </button>
  );
}

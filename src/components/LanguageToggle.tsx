"use client";

import { useLocale } from "@/components/LocaleProvider";

export function LanguageToggle({
  variant = "pill",
}: {
  variant?: "pill" | "panel";
}) {
  const { locale, toggleLocale, t } = useLocale();
  const isEs = locale === "es";

  return (
    <button
      type="button"
      onClick={toggleLocale}
      className={
        variant === "pill"
          ? "header-pill"
          : "btn btn-ghost shrink-0 px-4 py-2 text-sm"
      }
      aria-label={isEs ? t("language.switchToEn") : t("language.switchToEs")}
    >
      {isEs ? t("language.spanish") : t("language.english")}
    </button>
  );
}

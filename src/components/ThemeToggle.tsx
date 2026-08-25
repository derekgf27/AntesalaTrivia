"use client";

import { useTheme } from "@/components/ThemeProvider";
import { useLocale } from "@/components/LocaleProvider";

export function ThemeToggle({
  variant = "pill",
}: {
  variant?: "pill" | "panel";
}) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLocale();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={
        variant === "pill"
          ? "header-pill"
          : "btn btn-ghost shrink-0 px-4 py-2 text-sm"
      }
      aria-label={isLight ? t("theme.switchToDark") : t("theme.switchToLight")}
    >
      <span aria-hidden>{isLight ? "☀" : "☾"}</span>
      {isLight ? t("theme.lightMode") : t("theme.darkMode")}
    </button>
  );
}

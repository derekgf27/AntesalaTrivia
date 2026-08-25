"use client";

import { useLocale } from "@/components/LocaleProvider";

export function HostBreadcrumbs({
  nightTitle,
  phase,
  atHostHome,
  onHostHome,
  onOpenNight,
}: {
  nightTitle?: string | null;
  phase?: string | null;
  atHostHome: boolean;
  onHostHome: () => void;
  onOpenNight?: () => void;
}) {
  const { t } = useLocale();
  const finished = phase === "finished";

  return (
    <nav aria-label={t("hostBreadcrumbs.aria")} className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--muted)]">
        <li>
          {atHostHome ? (
            <span className="font-semibold text-[var(--text)]">
              {t("hostBreadcrumbs.host")}
            </span>
          ) : (
            <button
              type="button"
              className="font-semibold transition hover:text-[var(--accent)]"
              onClick={onHostHome}
            >
              {t("hostBreadcrumbs.host")}
            </button>
          )}
        </li>
        {nightTitle ? (
          <>
            <li aria-hidden className="opacity-50">
              /
            </li>
            <li>
              {atHostHome && onOpenNight ? (
                <button
                  type="button"
                  className="transition hover:text-[var(--accent)]"
                  onClick={onOpenNight}
                >
                  {nightTitle}
                </button>
              ) : (
                <span className="font-semibold text-[var(--text)]">
                  {nightTitle}
                </span>
              )}
            </li>
          </>
        ) : null}
        {finished ? (
          <>
            <li aria-hidden className="opacity-50">
              /
            </li>
            <li className={atHostHome ? "" : "font-semibold text-[var(--text)]"}>
              {t("hostBreadcrumbs.finished")}
            </li>
          </>
        ) : null}
      </ol>
    </nav>
  );
}

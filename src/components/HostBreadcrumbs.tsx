"use client";

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
  const finished = phase === "finished";

  return (
    <nav aria-label="Host breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[var(--muted)]">
        <li>
          {atHostHome ? (
            <span className="font-semibold text-[var(--text)]">Host</span>
          ) : (
            <button
              type="button"
              className="font-semibold transition hover:text-[var(--accent)]"
              onClick={onHostHome}
            >
              Host
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
              Finished
            </li>
          </>
        ) : null}
      </ol>
    </nav>
  );
}

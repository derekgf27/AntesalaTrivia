"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLocale } from "@/components/LocaleProvider";

export default function HomePage() {
  const { t } = useLocale();
  const [siteUrl, setSiteUrl] = useState("");

  useEffect(() => {
    setSiteUrl(window.location.origin);
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col items-center gap-5 text-center">
        <Image
          src="/logo.jpg"
          alt={t("home.logoAlt")}
          width={160}
          height={160}
          className="h-32 w-32 rounded-full object-cover shadow-[0_0_0_4px_var(--accent)] sm:h-36 sm:w-36"
          priority
        />
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-[var(--accent)]">
            {t("home.brand")}
          </p>
          <h1 className="font-display mt-2 text-5xl leading-none sm:text-6xl">
            {t("home.title")}
          </h1>
        </div>
      </div>

      <Link
        href="/join"
        className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-[1.75rem] bg-[var(--accent)] px-8 py-10 text-center text-[var(--navy)] shadow-[0_20px_50px_-20px_rgba(240,106,18,0.55)] transition hover:brightness-105 active:scale-[0.99] sm:min-h-56"
      >
        <span className="text-sm font-semibold uppercase tracking-[0.25em] opacity-80">
          {t("home.players")}
        </span>
        <span className="font-display text-5xl leading-none sm:text-6xl">
          {t("home.play")}
        </span>
        <span className="max-w-sm text-base font-medium opacity-80">
          {t("home.playHint")}
        </span>
      </Link>

      <div className="card-panel flex flex-col gap-5 p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center sm:gap-6">
          <div className="shrink-0 rounded-2xl bg-white p-3">
            {siteUrl ? (
              <QRCodeSVG
                value={siteUrl}
                size={132}
                bgColor="#ffffff"
                fgColor="#152033"
                level="M"
              />
            ) : (
              <div className="h-[132px] w-[132px]" aria-hidden />
            )}
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            {t("home.scanToJoin")}
          </p>
        </div>

        <div className="flex flex-col gap-4 border-t border-[var(--line)] pt-5">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="text-center sm:text-left">
              <p className="text-sm font-semibold text-[var(--text)]">
                {t("language.label")}
              </p>
              <p className="text-sm text-[var(--muted)]">{t("language.hint")}</p>
            </div>
            <LanguageToggle variant="panel" />
          </div>
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="text-center sm:text-left">
              <p className="text-sm font-semibold text-[var(--text)]">
                {t("theme.appearance")}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {t("theme.appearanceHint")}
              </p>
            </div>
            <ThemeToggle variant="panel" />
          </div>
        </div>
      </div>
    </main>
  );
}

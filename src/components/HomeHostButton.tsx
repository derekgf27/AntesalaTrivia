"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { unlockHostSession } from "@/lib/hostSession";

export function HomeHostButton() {
  const router = useRouter();
  const { t } = useLocale();

  return (
    <button
      type="button"
      onClick={() => {
        unlockHostSession();
        router.push("/admin");
      }}
      className="header-pill"
      aria-label={t("common.host")}
    >
      {t("common.host")}
    </button>
  );
}

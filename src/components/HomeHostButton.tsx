"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HostPinModal } from "@/components/HostPinModal";
import { useLocale } from "@/components/LocaleProvider";

export function HomeHostButton() {
  const router = useRouter();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="header-pill"
        aria-label={t("hostPin.aria")}
      >
        {t("common.host")}
      </button>
      <HostPinModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => {
          setOpen(false);
          router.push("/admin");
        }}
      />
    </>
  );
}

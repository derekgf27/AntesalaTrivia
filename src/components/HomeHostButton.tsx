"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { useGameState } from "@/lib/socket/GameProvider";

function HostPinModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { connected, hostAuth } = useGameState();
  const { t } = useLocale();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="host-pin-title"
        className="card-panel w-full max-w-md p-6 shadow-2xl"
      >
        <h2 id="host-pin-title" className="font-display text-3xl">
          {t("hostPin.title")}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{t("hostPin.body")}</p>
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            hostAuth(pin.trim())
              .then(() => onSuccess())
              .catch((err: unknown) => {
                setError(
                  err instanceof Error ? err.message : t("common.wrongPin"),
                );
              })
              .finally(() => setBusy(false));
          }}
        >
          <input
            className="input tracking-[0.35em] text-center text-3xl"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError(null);
            }}
            inputMode="numeric"
            autoFocus
            autoComplete="off"
          />
          {!connected && (
            <p className="text-sm text-[var(--warning)]">{t("hostPin.serverError")}</p>
          )}
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !connected || !pin.trim()}
          >
            {busy ? t("common.checking") : t("common.continue")}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
        </form>
      </div>
    </div>
  );
}

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

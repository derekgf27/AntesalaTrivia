"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
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
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="host-pin-title"
        className="card-panel w-full max-w-md p-6 shadow-2xl"
      >
        <h2 id="host-pin-title" className="font-display text-3xl">
          Host access
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Enter the admin PIN to open host controls. Players can&apos;t get in
          without it.
        </p>
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            hostAuth(pin.trim())
              .then(() => onSuccess())
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Wrong PIN");
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
            placeholder="PIN"
            autoFocus
            autoComplete="off"
          />
          {!connected && (
            <p className="text-sm text-[var(--warning)]">
              Can&apos;t reach the game server. On Vercel, add Upstash Redis
              env vars. Locally, refresh after the dev server is running.
            </p>
          )}
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !connected || !pin.trim()}
          >
            {busy ? "Checking…" : "Continue"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [hostOpen, setHostOpen] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");

  useEffect(() => {
    setSiteUrl(window.location.origin);
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col items-center gap-5 text-center sm:items-start sm:text-left">
        <Image
          src="/logo.jpg"
          alt="La Antesala — Food · Wine · Bar"
          width={160}
          height={160}
          className="h-36 w-36 rounded-full object-cover shadow-[0_0_0_4px_var(--accent)] sm:h-40 sm:w-40"
          priority
        />
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-[var(--accent)]">
            La Antesala
          </p>
          <h1 className="font-display mt-2 text-5xl leading-none sm:text-6xl">
            Trivia Night
          </h1>
          <p className="mt-3 text-[var(--muted)]">
            Food · Wine · Bar — pick how you&apos;re joining.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/join"
          className="flex min-h-44 flex-col justify-between rounded-[1.75rem] bg-[var(--accent)] p-6 text-left text-[var(--navy)] transition hover:brightness-105 active:scale-[0.99] sm:min-h-56"
        >
          <span className="text-sm font-semibold uppercase tracking-[0.2em] opacity-80">
            Players
          </span>
          <span>
            <span className="font-display block text-4xl sm:text-5xl">Play</span>
            <span className="mt-2 block text-base font-medium opacity-80">
              Enter a lobby code and compete
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setHostOpen(true)}
          className="flex min-h-44 flex-col justify-between rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface)] p-6 text-left transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)] active:scale-[0.99] sm:min-h-56"
        >
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            Staff only
          </span>
          <span>
            <span className="font-display block text-4xl text-[var(--text)] sm:text-5xl">
              Host
            </span>
            <span className="mt-2 block text-base text-[var(--muted)]">
              PIN required · run the night
            </span>
          </span>
        </button>
      </div>

      <div className="card-panel flex flex-col items-center gap-4 p-6 sm:flex-row sm:gap-6">
        <div className="shrink-0 rounded-2xl bg-white p-3">
          {siteUrl ? (
            <QRCodeSVG
              value={siteUrl}
              size={148}
              bgColor="#ffffff"
              fgColor="#152033"
              level="M"
            />
          ) : (
            <div className="h-[148px] w-[148px]" aria-hidden />
          )}
        </div>
        <div className="text-center sm:text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Scan to join
          </p>
          <p className="mt-2 text-[var(--muted)]">
            Point your camera at the code to open Trivia Night on your phone.
          </p>
          {siteUrl && (
            <p className="mt-3 break-all text-sm text-[var(--text)]">{siteUrl}</p>
          )}
        </div>
      </div>

      <HostPinModal
        open={hostOpen}
        onClose={() => setHostOpen(false)}
        onSuccess={() => {
          setHostOpen(false);
          router.push("/admin");
        }}
      />
    </main>
  );
}

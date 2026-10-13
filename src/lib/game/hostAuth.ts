import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_PIN = process.env.ADMIN_PIN?.trim() || "9271";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function signingKey(): string {
  return process.env.HOST_TOKEN_SECRET?.trim() || ADMIN_PIN;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyAdminPin(pin: string | undefined | null): boolean {
  return safeEqual(String(pin ?? "").trim(), ADMIN_PIN);
}

/** Signed session so host access does not depend on Redis being reachable. */
export function issueHostToken(): string {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  const sig = createHmac("sha256", signingKey()).update(exp).digest("base64url");
  return `${exp}.${sig}`;
}

export function verifyHostToken(token: string | undefined | null): boolean {
  const value = String(token ?? "").trim();
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const exp = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
  const expected = createHmac("sha256", signingKey())
    .update(exp)
    .digest("base64url");
  return safeEqual(sig, expected);
}

export function authenticateHost(pin: string | undefined | null): string {
  if (!verifyAdminPin(pin)) throw new Error("Wrong admin PIN");
  return issueHostToken();
}

export function requireHostToken(token: string | undefined | null): void {
  if (!verifyHostToken(token)) {
    throw new Error("Host session expired — enter the PIN again");
  }
}

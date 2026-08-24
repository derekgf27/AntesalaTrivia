import { randomUUID } from "crypto";

/** Server-only. Never import this from client components. */
export const ADMIN_PIN = process.env.ADMIN_PIN?.trim() || "9271";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const hostTokens = new Map<string, number>();

export function issueHostToken(): string {
  const token = randomUUID();
  hostTokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

export function verifyHostToken(token: string | undefined | null): boolean {
  const value = String(token ?? "").trim();
  if (!value) return false;
  const expiresAt = hostTokens.get(value);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    hostTokens.delete(value);
    return false;
  }
  // Sliding expiry while actively hosting
  hostTokens.set(value, Date.now() + TOKEN_TTL_MS);
  return true;
}

export function verifyAdminPin(pin: string | undefined | null): boolean {
  return String(pin ?? "").trim() === ADMIN_PIN;
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

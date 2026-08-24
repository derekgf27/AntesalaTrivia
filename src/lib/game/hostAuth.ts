import { randomUUID } from "crypto";
import {
  assertStoreReady,
  deleteHostToken,
  getHostTokenExpiry,
  setHostToken,
} from "./persist";

export const ADMIN_PIN = process.env.ADMIN_PIN?.trim() || "9271";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export async function issueHostToken(): Promise<string> {
  const token = randomUUID();
  await setHostToken(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

export async function verifyHostToken(
  token: string | undefined | null,
): Promise<boolean> {
  const value = String(token ?? "").trim();
  if (!value) return false;
  const expiresAt = await getHostTokenExpiry(value);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    await deleteHostToken(value);
    return false;
  }
  await setHostToken(value, Date.now() + TOKEN_TTL_MS);
  return true;
}

export function verifyAdminPin(pin: string | undefined | null): boolean {
  return String(pin ?? "").trim() === ADMIN_PIN;
}

export async function authenticateHost(
  pin: string | undefined | null,
): Promise<string> {
  assertStoreReady();
  if (!verifyAdminPin(pin)) throw new Error("Wrong admin PIN");
  return issueHostToken();
}

export async function requireHostToken(
  token: string | undefined | null,
): Promise<void> {
  if (!(await verifyHostToken(token))) {
    throw new Error("Host session expired — enter the PIN again");
  }
}

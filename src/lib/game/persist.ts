import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

const MEMORY = Symbol.for("antesala-trivia-memory");

type MemoryDb = {
  rooms: Map<string, unknown>;
  nights: unknown[];
  currentCode: string | null;
  tokens: Map<string, number>;
};

function memory(): MemoryDb {
  const g = globalThis as typeof globalThis & { [MEMORY]?: MemoryDb };
  if (!g[MEMORY]) {
    g[MEMORY] = {
      rooms: new Map(),
      nights: loadNightsFile(),
      currentCode: null,
      tokens: new Map(),
    };
  }
  return g[MEMORY]!;
}

const DATA_DIR = path.join(process.cwd(), "data");
const NIGHTS_FILE = path.join(DATA_DIR, "nights.json");

function loadNightsFile(): unknown[] {
  try {
    if (!existsSync(NIGHTS_FILE)) return [];
    const parsed = JSON.parse(readFileSync(NIGHTS_FILE, "utf8")) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNightsFile(nights: unknown[]) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(NIGHTS_FILE, JSON.stringify(nights, null, 2), "utf8");
  } catch {
    /* Vercel filesystem is read-only; ignore */
  }
}

export function redisEnabled() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

export function assertStoreReady() {
  if (process.env.VERCEL && !redisEnabled()) {
    throw new Error(
      "Vercel needs Upstash Redis. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in the project env vars.",
    );
  }
}

function redis() {
  return Redis.fromEnv();
}

export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!redisEnabled()) return fn();
  const r = redis();
  const lockKey = `lock:${key}`;
  for (let i = 0; i < 20; i++) {
    const ok = await r.set(lockKey, "1", { nx: true, px: 4000 });
    if (ok) {
      try {
        return await fn();
      } finally {
        await r.del(lockKey);
      }
    }
    await new Promise((res) => setTimeout(res, 40 + i * 15));
  }
  throw new Error("Game is busy — try again");
}

export async function getRoomData<T>(code: string): Promise<T | null> {
  const c = code.toUpperCase().trim();
  if (!c) return null;
  if (!redisEnabled()) return (memory().rooms.get(c) as T) ?? null;
  const value = await redis().get<T>(`room:${c}`);
  return value ?? null;
}

export async function setRoomData(code: string, data: unknown) {
  const c = code.toUpperCase().trim();
  if (!redisEnabled()) {
    memory().rooms.set(c, data);
    return;
  }
  await redis().set(`room:${c}`, data);
}

export async function getCurrentCode(): Promise<string | null> {
  if (!redisEnabled()) return memory().currentCode;
  const value = await redis().get<string>("currentCode");
  return value || null;
}

export async function setCurrentCode(code: string | null) {
  if (!redisEnabled()) {
    memory().currentCode = code;
    return;
  }
  const r = redis();
  if (!code) await r.del("currentCode");
  else await r.set("currentCode", code);
}

export async function getNightsData<T>(): Promise<T[]> {
  if (!redisEnabled()) return memory().nights as T[];
  const value = await redis().get<T[]>("nights");
  return Array.isArray(value) ? value : [];
}

export async function setNightsData(nights: unknown[]) {
  if (!redisEnabled()) {
    memory().nights = nights;
    writeNightsFile(nights);
    return;
  }
  await redis().set("nights", nights);
}

export async function setHostToken(token: string, expiresAt: number) {
  const ttlSec = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
  if (!redisEnabled()) {
    memory().tokens.set(token, expiresAt);
    return;
  }
  await redis().set(`token:${token}`, expiresAt, { ex: ttlSec });
}

export async function getHostTokenExpiry(
  token: string,
): Promise<number | null> {
  if (!redisEnabled()) return memory().tokens.get(token) ?? null;
  const value = await redis().get<number>(`token:${token}`);
  return typeof value === "number" ? value : null;
}

export async function deleteHostToken(token: string) {
  if (!redisEnabled()) {
    memory().tokens.delete(token);
    return;
  }
  await redis().del(`token:${token}`);
}

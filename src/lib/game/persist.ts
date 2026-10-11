import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { Redis } from "@upstash/redis";
import {
  REDIS_URL_HELP,
  hasRedisEnv,
  isRedisNetworkError,
  resolveRedisCredentials,
} from "./redisEnv";

const MEMORY = Symbol.for("antesala-trivia-memory");

type MemoryDb = {
  rooms: Map<string, unknown>;
  nights: unknown[];
  currentCode: string | null;
};

function memory(): MemoryDb {
  const g = globalThis as typeof globalThis & { [MEMORY]?: MemoryDb };
  if (!g[MEMORY]) {
    g[MEMORY] = {
      rooms: new Map(),
      nights: loadNightsFile(),
      currentCode: null,
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

let redisState: "unknown" | "up" | "down" = "unknown";

export function redisEnabled() {
  return hasRedisEnv() && redisState !== "down";
}

export function assertStoreReady() {
  if (hasRedisEnv() && !resolveRedisCredentials()) {
    throw new Error(REDIS_URL_HELP);
  }
  if (process.env.VERCEL && !hasRedisEnv()) {
    throw new Error(
      "Vercel needs Upstash Redis. In the Vercel project, add Storage → Upstash Redis (free), then redeploy. Expected env: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN).",
    );
  }
}

function redis() {
  const creds = resolveRedisCredentials();
  if (!creds) throw new Error(REDIS_URL_HELP);
  return new Redis({
    url: creds.url,
    token: creds.token,
    // undici throws TypeError "fetch failed" when keepalive is set on Vercel.
    keepAlive: false,
    cache: "no-store",
    retry: { retries: 1, backoff: () => 150 },
  });
}

/** Ping once. A deleted or unreachable database falls back to in-memory storage. */
async function redisIsUp(): Promise<boolean> {
  if (!hasRedisEnv() || !resolveRedisCredentials()) return false;
  if (redisState === "down") return false;
  if (redisState === "up") return true;
  try {
    const pong = await redis().ping();
    redisState = pong === "PONG" ? "up" : "down";
  } catch (error) {
    if (!isRedisNetworkError(error)) throw error;
    redisState = "down";
  }
  return redisState === "up";
}

async function redisOp<T>(
  fallback: () => Promise<T> | T,
  op: (client: Redis) => Promise<T>,
): Promise<T> {
  if (!(await redisIsUp())) return await fallback();
  try {
    return await op(redis());
  } catch (error) {
    if (!isRedisNetworkError(error)) throw error;
    redisState = "down";
    return await fallback();
  }
}

/** Confirm the store can be used. An unreachable Upstash host does not block the night. */
export async function assertRedisReachable() {
  assertStoreReady();
  await redisIsUp();
}

export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!(await redisIsUp())) return fn();
  try {
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
  } catch (error) {
    if (!isRedisNetworkError(error)) throw error;
    redisState = "down";
    return fn();
  }
}

export async function getRoomData<T>(code: string): Promise<T | null> {
  const c = code.toUpperCase().trim();
  if (!c) return null;
  return redisOp(
    () => (memory().rooms.get(c) as T) ?? null,
    (client) => client.get<T>(`room:${c}`).then((value) => value ?? null),
  );
}

export async function setRoomData(code: string, data: unknown) {
  const c = code.toUpperCase().trim();
  if (!c) return;
  await redisOp(
    () => {
      memory().rooms.set(c, data);
    },
    (client) => client.set(`room:${c}`, data),
  );
}

export async function deleteRoomData(code: string) {
  const c = code.toUpperCase().trim();
  if (!c) return;
  await redisOp(
    () => {
      memory().rooms.delete(c);
    },
    (client) => client.del(`room:${c}`),
  );
}

export async function getCurrentCode(): Promise<string | null> {
  return redisOp(
    () => memory().currentCode,
    async (client) => (await client.get<string>("currentCode")) || null,
  );
}

export async function setCurrentCode(code: string | null) {
  await redisOp(
    () => {
      memory().currentCode = code;
    },
    async (client) => {
      if (!code) await client.del("currentCode");
      else await client.set("currentCode", code);
    },
  );
}

export async function getNightsData<T>(): Promise<T[]> {
  return redisOp(
    () => memory().nights as T[],
    async (client) => {
      const value = await client.get<T[]>("nights");
      return Array.isArray(value) ? value : [];
    },
  );
}

export async function setNightsData(nights: unknown[]) {
  await redisOp(
    () => {
      memory().nights = nights;
      writeNightsFile(nights);
    },
    (client) => client.set("nights", nights),
  );
}

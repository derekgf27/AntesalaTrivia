import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import type { NightRecord } from "./types";

export type { NightRecord };

const DATA_DIR = path.join(process.cwd(), "data");
const NIGHTS_FILE = path.join(DATA_DIR, "nights.json");

function ensureStore(): NightRecord[] {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(NIGHTS_FILE)) {
    writeFileSync(NIGHTS_FILE, "[]", "utf8");
    return [];
  }
  try {
    const raw = readFileSync(NIGHTS_FILE, "utf8");
    const parsed = JSON.parse(raw) as NightRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(nights: NightRecord[]) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(NIGHTS_FILE, JSON.stringify(nights, null, 2), "utf8");
}

export function listNights(): NightRecord[] {
  return ensureStore()
    .map((n) => ({
      ...n,
      scheduledDate: n.scheduledDate || n.createdAt.slice(0, 10),
    }))
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
}

export function upsertNight(record: NightRecord) {
  const nights = ensureStore();
  const idx = nights.findIndex((n) => n.id === record.id);
  if (idx >= 0) nights[idx] = record;
  else nights.unshift(record);
  writeStore(nights);
}

export function searchNights(query: string): NightRecord[] {
  const q = query.trim().toLowerCase();
  const all = listNights();
  if (!q) return all;
  return all.filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.code.toLowerCase().includes(q) ||
      n.scheduledDate?.includes(q) ||
      n.createdAt.slice(0, 10).includes(q),
  );
}

export function findNightByCode(code: string): NightRecord | undefined {
  const normalized = code.toUpperCase().trim();
  return listNights().find((n) => n.code.toUpperCase() === normalized);
}

export function findOpenNight(): NightRecord | undefined {
  return listNights().find(
    (n) => !n.finishedAt && n.phase !== "finished",
  );
}

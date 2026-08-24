import type { NightRecord } from "./types";
import { getNightsData, setNightsData } from "./persist";

export type { NightRecord };

export async function listNights(): Promise<NightRecord[]> {
  const nights = await getNightsData<NightRecord>();
  return nights
    .map((n) => ({
      ...n,
      scheduledDate: n.scheduledDate || n.createdAt.slice(0, 10),
    }))
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
}

export async function upsertNight(record: NightRecord) {
  const nights = await getNightsData<NightRecord>();
  const idx = nights.findIndex((n) => n.id === record.id);
  if (idx >= 0) nights[idx] = record;
  else nights.unshift(record);
  await setNightsData(nights);
}

export async function searchNights(query: string): Promise<NightRecord[]> {
  const q = query.trim().toLowerCase();
  const all = await listNights();
  if (!q) return all;
  return all.filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.code.toLowerCase().includes(q) ||
      n.scheduledDate?.includes(q) ||
      n.createdAt.slice(0, 10).includes(q),
  );
}

export async function findNightByCode(
  code: string,
): Promise<NightRecord | undefined> {
  const normalized = code.toUpperCase().trim();
  const nights = await listNights();
  return nights.find((n) => n.code.toUpperCase() === normalized);
}

export async function findOpenNight(): Promise<NightRecord | undefined> {
  const nights = await listNights();
  return nights.find((n) => !n.finishedAt && n.phase !== "finished");
}

import { NextResponse } from "next/server";
import { assertStoreReady, redisEnabled } from "@/lib/game/persist";

export const runtime = "nodejs";

export async function GET() {
  try {
    assertStoreReady();
    return NextResponse.json({
      ok: true,
      redis: redisEnabled(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Game server is not ready";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

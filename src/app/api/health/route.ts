import { NextResponse } from "next/server";
import { assertRedisReachable, redisEnabled } from "@/lib/game/persist";
import { publicErrorMessage } from "@/lib/game/redisEnv";

export const runtime = "nodejs";

export async function GET() {
  try {
    await assertRedisReachable();
    return NextResponse.json({
      ok: true,
      redis: redisEnabled(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: publicErrorMessage(error) },
      { status: 503 },
    );
  }
}

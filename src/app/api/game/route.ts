import { NextRequest, NextResponse } from "next/server";
import {
  authenticateHost,
  requireHostToken,
} from "@/lib/game/hostAuth";
import { searchNights } from "@/lib/game/nightHistory";
import { gameStore, toAdmin, toPublic } from "@/lib/game/store";
import type { Question } from "@/lib/game/types";

export const runtime = "nodejs";

function fail(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Request failed";
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function adminCode(body: Record<string, unknown>): Promise<string> {
  await requireHostToken(String(body.hostToken || ""));
  const requested = String(body.code || "").trim();
  if (requested) {
    const room = await gameStore.getRoomOrRestore(requested);
    if (!room) throw new Error("Game not found");
    return room.code;
  }
  const current = await gameStore.hydrateOpenNight();
  if (!current) throw new Error("No trivia night is running — start a new one");
  return current.code;
}

async function afterMutate(code: string, extra: Record<string, unknown> = {}) {
  const room = await gameStore.getRoom(code);
  if (!room) return { ok: true as const, ...extra };
  return {
    ok: true as const,
    ...extra,
    state: toPublic(room),
    adminState: toAdmin(room),
  };
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code") || "";
    const view = req.nextUrl.searchParams.get("view") || "public";
    const playerId = req.nextUrl.searchParams.get("playerId") || undefined;
    const hostToken = req.nextUrl.searchParams.get("hostToken");

    if (!code.trim()) throw new Error("Missing lobby code");

    if (view === "admin") {
      await requireHostToken(hostToken);
      const adminState = await gameStore.snapshot(code, { admin: true });
      return NextResponse.json({ ok: true, adminState, state: adminState });
    }

    const state = await gameStore.snapshot(code, { playerId });
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status =
      message.includes("expired") || message.includes("PIN") ? 401 : 400;
    return fail(error, status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || "");

    switch (action) {
      case "hostAuth": {
        const hostToken = await authenticateHost(String(body.pin || ""));
        return NextResponse.json({ ok: true, hostToken });
      }

      case "createGame": {
        await requireHostToken(String(body.hostToken || ""));
        const room = await gameStore.createRoom({
          scheduledDate: String(body.scheduledDate || ""),
          expectedTeams: Number(body.expectedTeams) || 64,
          questions: Array.isArray(body.questions)
            ? (body.questions as Question[])
            : undefined,
        });
        return NextResponse.json({
          ok: true,
          state: toPublic(room),
          adminState: toAdmin(room),
        });
      }

      case "adminJoin": {
        await requireHostToken(String(body.hostToken || ""));
        const room = body.code
          ? await gameStore.getRoomOrRestore(String(body.code))
          : await gameStore.hydrateOpenNight();
        if (!room) {
          throw new Error("No trivia night is running — start a new one");
        }
        return NextResponse.json({
          ok: true,
          state: toPublic(room),
          adminState: toAdmin(room),
        });
      }

      case "listNights": {
        await requireHostToken(String(body.hostToken || ""));
        const current = await gameStore.hydrateOpenNight();
        const nights = await searchNights(String(body.query || ""));
        return NextResponse.json({
          ok: true,
          nights,
          hasCurrent: Boolean(current),
          currentCode: current?.code ?? null,
          currentTitle: current?.title ?? null,
        });
      }

      case "displayJoin": {
        const room = await gameStore.getRoomOrRestore(String(body.code || ""));
        if (!room) throw new Error("Game not found");
        return NextResponse.json({ ok: true, state: toPublic(room) });
      }

      case "peekLobby": {
        const room = await gameStore.getRoomOrRestore(String(body.code || ""));
        if (!room) throw new Error("Game not found");
        if (room.phase === "finished") throw new Error("This night is over");
        const publicState = toPublic(room);
        return NextResponse.json({
          ok: true,
          code: publicState.code,
          title: publicState.title,
          phase: publicState.phase,
          teams: publicState.teams.filter((t) => !t.isSolo),
        });
      }

      case "playerJoin": {
        const room = await gameStore.getRoomOrRestore(String(body.code || ""));
        if (!room) throw new Error("Game not found");
        if (room.phase === "finished") throw new Error("This night is over");
        const joined = await gameStore.mutate(room.code, (live) => {
          const { player, team } = gameStore.addPlayer(live, {
            playerName: String(body.playerName || ""),
            mode: body.mode as "solo" | "createTeam" | "joinTeam",
            teamName: body.teamName ? String(body.teamName) : undefined,
            teamId: body.teamId ? String(body.teamId) : undefined,
            playerId: body.playerId ? String(body.playerId) : undefined,
          });
          return {
            playerId: player.id,
            teamId: team.id,
            teamName: team.name,
          };
        });
        const latest = await gameStore.getRoom(room.code);
        return NextResponse.json({
          ok: true,
          ...joined,
          state: latest ? toPublic(latest) : toPublic(room),
        });
      }

      case "startQuestion": {
        const code = await adminCode(body);
        const result = await gameStore.mutate(code, (room) =>
          gameStore.startQuestion(room),
        );
        return NextResponse.json(await afterMutate(code, { result }));
      }

      case "forceLock": {
        const code = await adminCode(body);
        await gameStore.mutate(code, (room) => gameStore.forceLock(room));
        return NextResponse.json(await afterMutate(code));
      }

      case "pauseTimer": {
        const code = await adminCode(body);
        await gameStore.mutate(code, (room) => gameStore.pauseTimer(room));
        return NextResponse.json(await afterMutate(code));
      }

      case "resumeTimer": {
        const code = await adminCode(body);
        await gameStore.mutate(code, (room) => gameStore.resumeTimer(room));
        return NextResponse.json(await afterMutate(code));
      }

      case "restartTimer": {
        const code = await adminCode(body);
        await gameStore.mutate(code, (room) => gameStore.restartTimer(room));
        return NextResponse.json(await afterMutate(code));
      }

      case "nextQuestion": {
        const code = await adminCode(body);
        const result = await gameStore.mutate(code, (room) => {
          if (room.phase === "question") {
            throw new Error("Lock the question first");
          }
          if (room.phase === "locked") {
            throw new Error("Wait for the reveal");
          }
          if (room.questionIndex + 1 >= room.questions.length) {
            gameStore.finishGame(room);
            return "finished";
          }
          return gameStore.startQuestion(room);
        });
        return NextResponse.json(await afterMutate(code, { result }));
      }

      case "submitAnswer": {
        const code = String(body.code || "");
        const playerId = String(body.playerId || "");
        if (!code || !playerId) throw new Error("Join a team first");
        await gameStore.mutate(code, (room) => {
          const player = room.players[playerId];
          if (!player) throw new Error("Join a team first");
          player.lastSeenAt = Date.now();
          gameStore.submitAnswer(room, player.teamId, Number(body.optionIndex));
        });
        const latest = await gameStore.getRoom(code);
        return NextResponse.json({
          ok: true,
          state: latest ? toPublic(latest) : null,
        });
      }

      case "kickTeam": {
        const code = await adminCode(body);
        await gameStore.mutate(code, (room) =>
          gameStore.kickTeam(room, String(body.teamId || "")),
        );
        return NextResponse.json(await afterMutate(code));
      }

      case "adjustScore": {
        const code = await adminCode(body);
        await gameStore.mutate(code, (room) =>
          gameStore.adjustScore(
            room,
            String(body.teamId || ""),
            Number(body.delta),
          ),
        );
        return NextResponse.json(await afterMutate(code));
      }

      case "setQuestions": {
        const code = await adminCode(body);
        await gameStore.mutate(code, (room) =>
          gameStore.setQuestions(
            room,
            (body.questions as Question[]) || [],
            typeof body.timeLimitSec === "number"
              ? body.timeLimitSec
              : undefined,
          ),
        );
        return NextResponse.json(await afterMutate(code));
      }

      case "endGame": {
        const code = await adminCode(body);
        await gameStore.mutate(code, (room) => gameStore.finishGame(room));
        return NextResponse.json(await afterMutate(code));
      }

      default:
        throw new Error("Unknown action");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const status =
      message.includes("expired") || message.includes("Wrong admin PIN")
        ? 401
        : 400;
    return fail(error, status);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/lib/http";
import { db } from "@/lib/db";
import { allowCommand, CODE_PATTERN, findRemote, normalizeCode, REMOTE_COMMANDS } from "@/lib/teleprompter-remote";

// Used by the phone remote, which does not need to be signed in: knowing the code shown on
// the teleprompter is the permission. It can only send playback commands and read the
// playback state, never the script itself.
type Ctx = { params: Promise<{ code: string }> };

async function remoteFor(ctx: Ctx) {
  const code = normalizeCode((await ctx.params).code);
  if (!CODE_PATTERN.test(code)) return null;
  return findRemote(code);
}

function publicState(remote: { state: unknown; stateAt: Date | null }) {
  const fresh = Boolean(remote.stateAt && Date.now() - remote.stateAt.getTime() < 6000);
  const state = (remote.state || {}) as Record<string, unknown>;
  return { connected: fresh, playing: !!state.playing, open: !!state.open, speed: state.speed ?? null, fontSize: state.fontSize ?? null, mirror: !!state.mirror, progress: state.progress ?? 0, title: state.title ?? null };
}

async function handleGET(_req: Request, ctx: Ctx) {
  const remote = await remoteFor(ctx);
  if (!remote) return NextResponse.json({ error: "This code is not valid or has expired." }, { status: 404 });
  await db.$executeRaw`UPDATE "TeleprompterRemote" SET "remoteAt" = now() WHERE "code" = ${remote.code}`;
  return NextResponse.json(publicState(remote), { headers: { "cache-control": "no-store" } });
}

const schema = z.object({ command: z.enum(REMOTE_COMMANDS), value: z.number().min(5).max(300).optional() });

async function handlePOST(req: Request, ctx: Ctx) {
  const remote = await remoteFor(ctx);
  if (!remote) return NextResponse.json({ error: "This code is not valid or has expired." }, { status: 404 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Unknown command" }, { status: 400 });
  if (!allowCommand(remote.code)) return NextResponse.json({ error: "Too many taps, slow down." }, { status: 429 });
  await db.$executeRaw`INSERT INTO "TeleprompterCommand" ("code", "command", "value") VALUES (${remote.code}, ${parsed.data.command}, ${parsed.data.value ?? null})`;
  await db.$executeRaw`UPDATE "TeleprompterRemote" SET "remoteAt" = now() WHERE "code" = ${remote.code}`;
  return NextResponse.json({ ok: true });
}

export const GET = api(handleGET);
export const POST = api(handlePOST);

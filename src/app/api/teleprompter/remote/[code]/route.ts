import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/lib/http";
import { AuthError, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { findRemote, normalizeCode } from "@/lib/teleprompter-remote";

type Ctx = { params: Promise<{ code: string }> };

async function ownRemote(ctx: Ctx) {
  const user = await requireUser();
  const remote = await findRemote(normalizeCode((await ctx.params).code));
  if (!remote) return null;
  if (remote.ownerId !== user.id) throw new AuthError(403);
  return remote;
}

// The teleprompter polls for new commands from the phone.
async function handleGET(req: Request, ctx: Ctx) {
  const remote = await ownRemote(ctx);
  if (!remote) return NextResponse.json({ error: "Expired" }, { status: 404 });
  const after = Number(new URL(req.url).searchParams.get("after") || 0) || 0;
  const commands = await db.$queryRaw<{ id: bigint; command: string; value: number | null }[]>`SELECT "id", "command", "value" FROM "TeleprompterCommand" WHERE "code" = ${remote.code} AND "id" > ${after} ORDER BY "id" LIMIT 50`;
  return NextResponse.json({
    commands: commands.map((c) => ({ id: Number(c.id), command: c.command, value: c.value })),
    remoteConnected: Boolean(remote.remoteAt && Date.now() - remote.remoteAt.getTime() < 6000),
  }, { headers: { "cache-control": "no-store" } });
}

const stateSchema = z.object({
  playing: z.boolean(),
  open: z.boolean(),
  speed: z.number(),
  fontSize: z.number(),
  mirror: z.boolean(),
  progress: z.number().min(0).max(1),
  title: z.string().max(200).optional(),
});

// The teleprompter reports its state so the phone can show it.
async function handlePUT(req: Request, ctx: Ctx) {
  const remote = await ownRemote(ctx);
  if (!remote) return NextResponse.json({ error: "Expired" }, { status: 404 });
  const parsed = stateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  await db.$executeRaw`UPDATE "TeleprompterRemote" SET "state" = ${JSON.stringify(parsed.data)}::jsonb, "stateAt" = now() WHERE "code" = ${remote.code}`;
  return NextResponse.json({ ok: true });
}

export const GET = api(handleGET);
export const PUT = api(handlePUT);

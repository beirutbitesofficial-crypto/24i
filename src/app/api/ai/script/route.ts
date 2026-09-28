import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/lib/http";
import { AuthError, authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { AiError, generateScript } from "@/lib/ai";

const schema = z.object({
  clientId: z.string().min(1),
  mode: z.enum(["write", "improve"]).default("write"),
  idea: z.string().trim().max(2000).default(""),
  format: z.enum(["REEL", "POST", "STORY"]).default("REEL"),
  seconds: z.coerce.number().int().min(5).max(180).default(30),
  language: z.enum(["LEBANESE", "ARABIZI", "ENGLISH", "MIXED"]).default("LEBANESE"),
  tone: z.string().trim().max(120).optional(),
  current: z.string().trim().max(12000).optional(),
}).refine((v) => (v.mode === "write" ? v.idea.length >= 3 : Boolean(v.current)), { message: "Describe the idea first" });

const ROLES = new Set(["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER", "EDITOR", "CLIENT"]);

// Simple per-user limit so a stuck button or a curious client cannot run up the OpenAI bill.
const LIMIT = 40;
const WINDOW_MS = 60 * 60 * 1000;
const usage = new Map<string, number[]>();
function allow(userId: string) {
  const now = Date.now();
  const recent = (usage.get(userId) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return false;
  recent.push(now);
  usage.set(userId, recent);
  return true;
}

async function handlePOST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
  const user = await authorize("content.read", parsed.data.clientId);
  if (!ROLES.has(user.role.key)) throw new AuthError(403);
  if (!allow(user.id)) return NextResponse.json({ error: `You reached the limit of ${LIMIT} AI scripts per hour. Try again later.` }, { status: 429 });

  const brand = await db.client.findUnique({ where: { id: parsed.data.clientId }, select: { brandName: true, industry: true, instagram: true, notes: true } });
  if (!brand) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    // Internal notes about the client stay internal: they are only used for staff requests.
    const script = await generateScript({ ...parsed.data, brand: user.role.key === "CLIENT" ? { ...brand, notes: null } : brand });
    return NextResponse.json(script);
  } catch (error) {
    if (error instanceof AiError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

export const POST = api(handlePOST);

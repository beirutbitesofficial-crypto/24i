import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

const input = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const parsed = input.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });

  if (
    !user ||
    user.status !== "ACTIVE" ||
    !(await verifyPassword(user.passwordHash, parsed.data.password))
  ) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}

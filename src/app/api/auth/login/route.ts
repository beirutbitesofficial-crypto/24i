import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";

let dummy: Promise<string> | undefined;
const dummyHash = () => (dummy ??= hashPassword("timing-equaliser-password"));

const input = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

async function handlePOST(req: Request) {
  try {
    const parsed = input.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;

    const user = await db.user.findUnique({ where: { email } });
    // Always run a hash check so response time does not reveal whether the email exists.
    const passwordOk = await verifyPassword(user?.passwordHash ?? (await dummyHash()), password);
    const valid = Boolean(user && user.status === "ACTIVE" && passwordOk);

    // Only reveal a pending status to someone who knows the password.
    if (user && passwordOk && user.status === "PENDING") {
      return NextResponse.json({ error: "Your account is waiting for 24i Production to approve it. You'll be able to sign in once it's confirmed." }, { status: 403 });
    }

    if (!user || !valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Login/database error:", error);
    return NextResponse.json(
      { error: "Database or server unavailable. Check DATABASE_URL and deployment logs." },
      { status: 503 }
    );
  }
}

export const POST = api(handlePOST);

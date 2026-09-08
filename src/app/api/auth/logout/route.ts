import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const input = z.object({
  pushEndpoint: z.string().url().optional(),
});

export async function POST(req: Request) {
  const user = await currentUser();
  const body = await req.json().catch(() => ({}));
  const parsed = input.safeParse(body);

  if (user && parsed.success && parsed.data.pushEndpoint) {
    await db.pushSubscription.deleteMany({
      where: {
        userId: user.id,
        endpoint: parsed.data.pushEndpoint,
      },
    });
  }

  (await cookies()).delete("session");
  return NextResponse.json({ ok: true });
}

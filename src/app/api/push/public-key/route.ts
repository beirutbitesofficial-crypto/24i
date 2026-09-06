import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function GET() {
  await requireUser();
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: "Push notifications are not configured" }, { status: 503 });
  return NextResponse.json({ publicKey });
}

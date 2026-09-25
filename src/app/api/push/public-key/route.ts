import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

async function handleGET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: "Push notifications are not configured" }, { status: 503 });
  return NextResponse.json({ publicKey });
}

export const GET = api(handleGET);

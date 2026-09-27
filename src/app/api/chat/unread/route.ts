import { NextResponse } from "next/server";
import { api } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { chatClientIds, isChatUser, unreadByClient } from "@/lib/chat";

async function handleGET() {
  const user = await requireUser();
  if (!isChatUser(user)) return NextResponse.json({ unread: 0 });
  const counts = await unreadByClient(user, chatClientIds(user));
  return NextResponse.json({ unread: [...counts.values()].reduce((a, b) => a + b, 0) }, { headers: { "cache-control": "no-store" } });
}

export const GET = api(handleGET);

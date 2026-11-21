import { NextResponse } from "next/server";
import { api } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { createRemote } from "@/lib/teleprompter-remote";

// The teleprompter asks for a pairing code to show on screen.
async function handlePOST() {
  const user = await requireUser();
  return NextResponse.json({ code: await createRemote(user.id) });
}

export const POST = api(handlePOST);

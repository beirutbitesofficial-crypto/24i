import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { reconcilePublishingAttempts } from "@/lib/publishing";

async function handlePOST(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await reconcilePublishingAttempts();
  return NextResponse.json(result);
}

export const POST = api(handlePOST);

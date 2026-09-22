import { NextResponse } from "next/server";
import { reconcilePublishingAttempts } from "@/lib/publishing";

export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await reconcilePublishingAttempts();
  return NextResponse.json(result);
}

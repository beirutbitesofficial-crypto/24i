import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ensureMeetingTables } from "@/lib/db-upgrades";
import { BLOCKING_STATUSES } from "@/lib/meetings";

export const dynamic = "force-dynamic";

/** Times already requested or confirmed on a day, so the booking form can hide them. */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ taken: [] });
  try {
    await ensureMeetingTables();
    const rows = await db.meetingRequest.findMany({ where: { date, status: { in: BLOCKING_STATUSES } }, select: { time: true } });
    return NextResponse.json({ taken: rows.map((r) => r.time) });
  } catch {
    return NextResponse.json({ taken: [] });
  }
}

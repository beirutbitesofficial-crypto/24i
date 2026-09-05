import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authorize("notifications.read");
  const { id } = await params;
  const notification = await db.notification.findFirst({ where: { id, userId: user.id } });
  if (!notification) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.notification.update({ where: { id }, data: { readAt: notification.readAt || new Date() } });
  return NextResponse.json({ ok: true });
}

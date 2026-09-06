import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";

export async function POST() {
  const user = await requireUser();
  if (user.role.key !== "ADMIN") {
    return NextResponse.json({ error: "Only Admin can send a global test notification" }, { status: 403 });
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    return NextResponse.json({ error: "VAPID settings are incomplete on the server" }, { status: 503 });
  }

  const users = await db.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  const userIds = users.map((x) => x.id);
  const subscriptions = await db.pushSubscription.count({ where: { userId: { in: userIds } } });

  if (!userIds.length) {
    return NextResponse.json({ error: "No active users found" }, { status: 404 });
  }

  await notify(userIds, {
    kind: "SYSTEM",
    title: "24i Production test",
    body: "Push notifications are working on this device.",
    deepLink: "/notifications",
  });

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "GLOBAL_TEST_NOTIFICATION_SENT",
      entityType: "PushNotification",
      newValue: { activeUsers: userIds.length, subscriptions },
    },
  });

  return NextResponse.json({ ok: true, activeUsers: userIds.length, subscriptions });
}

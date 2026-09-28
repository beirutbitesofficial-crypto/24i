import webpush from "web-push";
import { after } from "next/server";
import { db } from "./db";
import type { NotificationKind, Prisma } from "@prisma/client";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

type Message = { kind: NotificationKind; title: string; body: string; deepLink: string };
type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

async function sendPushes(subscriptions: Subscription[], message: Message) {
  await Promise.allSettled(subscriptions.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message));
    } catch (error: unknown) {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      else console.error("push failed", status ?? error);
    }
  }));
}

// Saves in-app notifications right away; phone push notifications are sent after the
// response has gone out, so the user who triggered them never waits on the push services.
export async function notify(userIds: string[], message: Message, tx: Prisma.TransactionClient = db) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  await tx.notification.createMany({ data: ids.map((userId) => ({ userId, ...message })) });
  if (!process.env.VAPID_PRIVATE_KEY) return;
  const subscriptions = await tx.pushSubscription.findMany({ where: { userId: { in: ids } } });
  if (!subscriptions.length) return;
  try {
    after(() => sendPushes(subscriptions, message));
  } catch {
    // Outside a request (scripts, cron helpers): just send in the background.
    void sendPushes(subscriptions, message);
  }
}

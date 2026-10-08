import { randomBytes } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { bookingSchema } from "@/lib/website/forms";
import { deliver, deliveryConfigured, rateLimited } from "@/lib/website/deliver";
import { db } from "@/lib/db";
import { ensureMeetingTables } from "@/lib/db-upgrades";
import { notify } from "@/lib/notifications";
import { BLOCKING_STATUSES, MEETING_ROLES, formatMeetingDate, notifyManagerOnWhatsApp } from "@/lib/meetings";

// Website "Book a meeting": saves a PENDING request in the system, notifies managers in the app
// (and by push), sends the manager a WhatsApp message, and returns a status link for the client.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (rateLimited(ip)) return NextResponse.json({ ok: false, error: "Too many requests. Please try again in a few minutes." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    if ("company_website" in fieldErrors) return NextResponse.json({ ok: true });
    return NextResponse.json({ ok: false, error: "Please check the highlighted fields.", fieldErrors }, { status: 422 });
  }
  const d = parsed.data;

  try {
    await ensureMeetingTables();
    const taken = await db.meetingRequest.findFirst({ where: { date: d.date, time: d.time, status: { in: BLOCKING_STATUSES } }, select: { id: true } });
    if (taken) {
      return NextResponse.json({ ok: false, error: "That time was just requested by someone else. Please pick another slot.", fieldErrors: { time: "This time is no longer available." } }, { status: 409 });
    }

    const meeting = await db.meetingRequest.create({
      data: {
        token: randomBytes(18).toString("base64url"),
        name: d.name,
        email: d.email,
        phone: d.phone,
        service: d.service,
        date: d.date,
        time: d.time,
        format: d.format,
        notes: d.notes || null,
      },
    });

    const managers = await db.user.findMany({ where: { status: "ACTIVE", role: { key: { in: MEETING_ROLES } } }, select: { id: true } });
    await notify(managers.map((m) => m.id), {
      kind: "SYSTEM",
      title: "New meeting request",
      body: `${d.name} · ${d.service} · ${formatMeetingDate(d.date)} ${d.time} (${d.format}). Waiting for your confirmation.`,
      deepLink: "/meetings",
    });

    after(async () => {
      await notifyManagerOnWhatsApp(meeting);
      if (deliveryConfigured()) {
        await deliver({
          kind: "booking",
          subject: `Meeting request: ${d.date} ${d.time} (Lebanon time) with ${d.name}`,
          replyTo: d.email,
          fields: { Name: d.name, Email: d.email, Phone: d.phone, Service: d.service, Date: d.date, "Time (Lebanon)": d.time, Format: d.format, Notes: d.notes },
        }).catch((error) => console.error("[booking] email delivery failed", error));
      }
    });

    const statusUrl = `/website/booking/${meeting.id}?t=${meeting.token}`;
    return NextResponse.json({ ok: true, status: meeting.status, statusUrl }, { status: 201 });
  } catch (error) {
    console.error("[booking] failed", error);
    return NextResponse.json({ ok: false, error: "We couldn't save your request right now. Please try again or reach us on WhatsApp." }, { status: 500 });
  }
}

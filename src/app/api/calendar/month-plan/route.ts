import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";

const itemSchema = z.object({
  type: z.enum(["REEL", "STATIC_POST"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(200),
});

const schema = z.object({
  clientId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  items: z.array(itemSchema).min(1).max(60),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const user = await authorize("calendar.write", parsed.data.clientId);
  const client = await db.client.findUnique({ where: { id: parsed.data.clientId }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (parsed.data.items.some((item) => !item.date.startsWith(`${parsed.data.month}-`))) {
    return NextResponse.json({ error: "All plan dates must be inside the selected month" }, { status: 400 });
  }

  const rows = await db.$transaction(async (tx) => {
    const created = [];
    for (const item of parsed.data.items) {
      const scheduledAt = new Date(`${item.date}T12:00:00.000Z`);
      const content = await tx.contentItem.create({
        data: {
          clientId: parsed.data.clientId,
          title: item.title,
          type: item.type,
          platform: ["INSTAGRAM"],
          status: "CONTENT_PLAN",
          plannedAt: scheduledAt,
        },
      });
      const calendar = await tx.calendarEntry.create({
        data: {
          contentId: content.id,
          scheduledAt,
          publishingStatus: "SCHEDULED",
        },
      });
      created.push({ contentId: content.id, calendarId: calendar.id });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "MONTHLY_CONTENT_PLAN_CREATED",
        entityType: "Client",
        entityId: parsed.data.clientId,
        newValue: {
          month: parsed.data.month,
          count: parsed.data.items.length,
          posts: parsed.data.items.filter((item) => item.type === "STATIC_POST").length,
          reels: parsed.data.items.filter((item) => item.type === "REEL").length,
        },
      },
    });

    return created;
  });

  return NextResponse.json({ ok: true, created: rows.length }, { status: 201 });
}

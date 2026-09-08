import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";

const schema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(1).max(200).default("Shooting day"),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  location: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(3000).optional(),
});

const allowedRoles = new Set(["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER"]);

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.endAt <= parsed.data.startAt) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  const user = await authorize("calendar.write", parsed.data.clientId);
  if (!allowedRoles.has(user.role.key)) {
    return NextResponse.json({ error: "Only Admin, Manager or Social Media Manager can reserve shooting days" }, { status: 403 });
  }

  const client = await db.client.findUnique({ where: { id: parsed.data.clientId }, select: { id: true, brandName: true } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const conflict = await db.task.findFirst({
    where: {
      category: "SHOOTING_RESERVATION",
      status: { not: "COMPLETED" },
      startAt: { lt: parsed.data.endAt },
      dueAt: { gt: parsed.data.startAt },
    },
    include: { client: true },
  });

  if (conflict) {
    return NextResponse.json({
      error: `This time overlaps another shooting${conflict.client?.brandName ? ` for ${conflict.client.brandName}` : ""}.`,
    }, { status: 409 });
  }

  const reservation = await db.$transaction(async (tx) => {
    const row = await tx.task.create({
      data: {
        clientId: client.id,
        title: parsed.data.title,
        description: parsed.data.notes,
        category: "SHOOTING_RESERVATION",
        priority: "MEDIUM",
        startAt: parsed.data.startAt,
        dueAt: parsed.data.endAt,
        status: "TODO",
        recurrence: {
          kind: "SHOOTING_RESERVATION",
          location: parsed.data.location || "",
        },
        assignees: { create: [{ userId: user.id }] },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "SHOOTING_DAY_RESERVED",
        entityType: "Task",
        entityId: row.id,
        newValue: {
          clientId: client.id,
          startAt: parsed.data.startAt.toISOString(),
          endAt: parsed.data.endAt.toISOString(),
          location: parsed.data.location,
        },
      },
    });
    return row;
  });

  let socialManagers = await db.user.findMany({
    where: {
      status: "ACTIVE",
      role: { key: "SOCIAL_MEDIA_MANAGER" },
      clientUsers: { some: { clientId: client.id } },
    },
    select: { id: true },
  });
  if (!socialManagers.length) {
    socialManagers = await db.user.findMany({
      where: { status: "ACTIVE", role: { key: "SOCIAL_MEDIA_MANAGER" } },
      select: { id: true },
    });
  }
  const managers = await db.user.findMany({
    where: { status: "ACTIVE", role: { key: "MANAGER" } },
    select: { id: true },
  });
  const recipients = [...new Set([
    ...socialManagers.map((item) => item.id),
    ...managers.map((item) => item.id),
  ].filter((id) => id !== user.id))];

  if (recipients.length) {
    await notify(recipients, {
      kind: "SYSTEM",
      title: "Shooting day reserved",
      body: `${user.name} reserved ${client.brandName} · ${parsed.data.title}.`,
      deepLink: "/shooting",
    });
  }

  return NextResponse.json(reservation, { status: 201 });
}

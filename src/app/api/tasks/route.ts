import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";

const schema = z.object({
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  category: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  startAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().optional(),
  assigneeIds: z.array(z.string()).min(1),
  recurrence: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const user = await authorize("tasks.write", parsed.data.clientId);
  if (user.role.key === "SOCIAL_MEDIA_MANAGER" && !parsed.data.clientId) {
    return NextResponse.json({ error: "Social Media Managers must create tasks inside an assigned client." }, { status: 403 });
  }

  const { assigneeIds: rawAssigneeIds, ...data } = parsed.data;
  const assigneeIds = [...new Set(rawAssigneeIds)];

  const task = await db.$transaction(async (tx) => {
    const row = await tx.task.create({
      data: {
        ...data,
        recurrence: data.recurrence as any,
        assignees: { create: assigneeIds.map((userId) => ({ userId })) },
      },
      include: { client: { select: { brandName: true } } },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "TASK_CREATED",
        entityType: "Task",
        entityId: row.id,
        newValue: { ...parsed.data, assigneeIds } as any,
      },
    });
    return row;
  });

  // A task notification goes only to the selected assignees.
  if (assigneeIds.length) {
    await notify(assigneeIds, {
      kind: "TASK",
      title: `New task from ${user.name}`,
      body: `${task.client?.brandName ? `${task.client.brandName} · ` : ""}${task.title}`,
      deepLink: "/tasks",
    });
  }

  return NextResponse.json(task, { status: 201 });
}

import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { checkClients, checkProject, checkStaff, firstError } from "@/lib/scope";

const schema = z.object({
  clientId: z.string().optional(),
  projectId: z.string().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  category: z.string().trim().min(1).max(80),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  startAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().optional(),
  assigneeIds: z.array(z.string()).min(1).max(20),
  recurrence: z.record(z.string(), z.unknown()).optional(),
}).refine((v) => !v.startAt || !v.dueAt || v.dueAt >= v.startAt, { message: "Due date must be after the start date", path: ["dueAt"] });

async function handlePOST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const user = await authorize("tasks.write", parsed.data.clientId);
  if (user.role.key === "SOCIAL_MEDIA_MANAGER" && !parsed.data.clientId) {
    return NextResponse.json({ error: "Social Media Managers must create tasks inside an assigned client." }, { status: 403 });
  }

  const invalid = await firstError(
    checkClients(parsed.data.clientId ? [parsed.data.clientId] : []),
    checkProject(parsed.data.projectId, parsed.data.clientId ?? null),
    checkStaff(parsed.data.assigneeIds),
  );
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const { assigneeIds, ...data } = parsed.data;
  const task = await db.$transaction(async (tx) => {
    const row = await tx.task.create({
      data: {
        ...data,
        recurrence: data.recurrence as any,
        assignees: { create: [...new Set(assigneeIds)].map((userId) => ({ userId })) },
      },
    });
    await tx.auditLog.create({
      data: { userId: user.id, action: "TASK_CREATED", entityType: "Task", entityId: row.id, newValue: parsed.data as any },
    });
    return row;
  });

  await notify(assigneeIds, { kind: "TASK", title: "New task", body: task.title, deepLink: `/tasks` });
  return NextResponse.json(task, { status: 201 });
}

export const POST = api(handlePOST);

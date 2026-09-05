import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  status: z.enum(["TODO","IN_PROGRESS","REVIEW","REVISION","WAITING_CLIENT","COMPLETED"]),
  note: z.string().max(2000).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const task = await db.task.findUnique({ where: { id }, include: { assignees: true } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await authorize("tasks.update", task.clientId || undefined);
  if (user.role.key === "EDITOR" && !task.assignees.some((a) => a.userId === user.id)) {
    return NextResponse.json({ error: "Editors can update only assigned tasks" }, { status: 403 });
  }

  const row = await db.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: { status: parsed.data.status, comments: parsed.data.note ? { create: { authorId: user.id, body: parsed.data.note } } : undefined },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "TASK_STATUS_CHANGED",
        entityType: "Task",
        entityId: id,
        previousValue: { status: task.status },
        newValue: { status: parsed.data.status, note: parsed.data.note },
      },
    });
    return updated;
  });
  return NextResponse.json(row);
}

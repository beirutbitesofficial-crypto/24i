import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  clientId: z.string(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: z.string().trim().min(1).max(40).default("ACTIVE"),
});

export async function GET() {
  const user = await authorize("projects.read");
  const ids = assignedClientIds(user);
  const rows = await db.project.findMany({ where: ids ? { clientId: { in: ids } } : {}, include: { client: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const user = await authorize("projects.write", parsed.data.clientId);
  const project = await db.$transaction(async (tx) => {
    const row = await tx.project.create({ data: parsed.data });
    await tx.auditLog.create({ data: { userId: user.id, action: "PROJECT_CREATED", entityType: "Project", entityId: row.id, newValue: parsed.data } });
    return row;
  });
  return NextResponse.json(project, { status: 201 });
}

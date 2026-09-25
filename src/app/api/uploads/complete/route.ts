import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkContent, checkProject, checkTask, firstError } from "@/lib/scope";
import { statUpload } from "@/lib/storage";

const schema = z.object({
  clientId: z.string(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  contentId: z.string().optional(),
  key: z.string().startsWith("clients/").max(300),
  originalName: z.string().trim().min(1).max(255),
  checksum: z.string().max(200).optional(),
});

async function handlePOST(req: Request) {
  const p = schema.safeParse(await req.json());
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  const u = await authorize("files.write", p.data.clientId);
  if (!p.data.key.startsWith(`clients/${p.data.clientId}/`)) return NextResponse.json({ error: "Invalid storage scope" }, { status: 403 });

  const invalid = await firstError(
    checkProject(p.data.projectId, p.data.clientId),
    checkTask(p.data.taskId, p.data.clientId),
    checkContent(p.data.contentId, p.data.clientId),
  );
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  if (await db.fileObject.findUnique({ where: { key: p.data.key } })) return NextResponse.json({ error: "File already registered" }, { status: 409 });

  // Trust what storage reports, not what the browser claims.
  const stored = await statUpload(p.data.key);
  if (!stored) return NextResponse.json({ error: "Upload not found in storage" }, { status: 400 });

  const file = await db.$transaction(async (tx) => {
    const row = await tx.fileObject.create({ data: { ...p.data, mimeType: stored.mimeType, size: BigInt(stored.size), uploadedById: u.id } });
    await tx.auditLog.create({ data: { userId: u.id, action: "FILE_UPLOADED", entityType: "FileObject", entityId: row.id, newValue: { key: row.key, mimeType: row.mimeType, size: row.size.toString() } } });
    return row;
  });
  return NextResponse.json({ ...file, size: file.size.toString() }, { status: 201 });
}

export const POST = api(handlePOST);

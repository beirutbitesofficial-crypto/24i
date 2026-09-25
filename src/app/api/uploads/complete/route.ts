import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { checkContent, checkProject, checkTask, firstError } from "@/lib/scope";
import { isAllowedType, statUpload } from "@/lib/storage";

const schema = z.object({
  clientId: z.string(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  contentId: z.string().optional(),
  key: z.string().startsWith("clients/").max(300),
  originalName: z.string().trim().min(1).max(255),
  // Browser-reported values are only a fallback; storage is the source of truth.
  mimeType: z.string().max(100).optional(),
  size: z.string().regex(/^\d+$/).optional(),
  checksum: z.string().max(200).optional(),
});

async function handlePOST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const user = await authorize("files.write", parsed.data.clientId);
  if (!parsed.data.key.startsWith(`clients/${parsed.data.clientId}/`)) {
    return NextResponse.json({ error: "Invalid storage scope" }, { status: 403 });
  }

  const client = await db.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { brandName: true },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const invalid = await firstError(
    checkProject(parsed.data.projectId, parsed.data.clientId),
    checkTask(parsed.data.taskId, parsed.data.clientId),
    checkContent(parsed.data.contentId, parsed.data.clientId),
  );
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  if (await db.fileObject.findUnique({ where: { key: parsed.data.key } })) {
    return NextResponse.json({ error: "File already registered" }, { status: 409 });
  }

  const stored = await statUpload(parsed.data.key);
  if (!stored || stored.size < 1) return NextResponse.json({ error: "Upload not found in storage" }, { status: 400 });
  // Some browsers (notably Safari) store uploads as a generic type; only then fall back to
  // the type the browser declared, and only if that type is on the allow-list.
  const generic = !stored.mimeType || stored.mimeType === "application/octet-stream";
  const mimeType = isAllowedType(stored.mimeType) ? stored.mimeType : generic && parsed.data.mimeType && isAllowedType(parsed.data.mimeType) ? parsed.data.mimeType : null;
  if (!mimeType) return NextResponse.json({ error: "This file type is not supported" }, { status: 400 });

  const file = await db.fileObject.create({
    data: {
      clientId: parsed.data.clientId,
      projectId: parsed.data.projectId,
      taskId: parsed.data.taskId,
      contentId: parsed.data.contentId,
      key: parsed.data.key,
      originalName: parsed.data.originalName,
      checksum: parsed.data.checksum,
      mimeType,
      size: BigInt(stored.size),
      uploadedById: user.id,
    },
  });

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "FILE_UPLOADED",
      entityType: "FileObject",
      entityId: file.id,
      newValue: { key: file.key, mimeType: file.mimeType, size: file.size.toString() },
    },
  });

  // Files uploaded from the shared asset library should hand off to the
  // Social Media Manager assigned to this client. Fall back to all active
  // SMMs so a file never gets uploaded without somebody being alerted.
  if (user.role.key === "MANAGER" || user.role.key === "ADMIN") {
    let socialManagers = await db.user.findMany({
      where: {
        status: "ACTIVE",
        role: { key: "SOCIAL_MEDIA_MANAGER" },
        clientUsers: { some: { clientId: parsed.data.clientId } },
      },
      select: { id: true },
    });

    if (!socialManagers.length) {
      socialManagers = await db.user.findMany({
        where: { status: "ACTIVE", role: { key: "SOCIAL_MEDIA_MANAGER" } },
        select: { id: true },
      });
    }

    const recipients = [...new Set(socialManagers.map((item) => item.id).filter((id) => id !== user.id))];
    if (recipients.length) {
      await notify(recipients, {
        kind: "SYSTEM",
        title: "New file uploaded — check it",
        body: `${user.name} uploaded ${file.originalName} for ${client.brandName}.`,
        deepLink: "/files",
      });
    }
  }

  return NextResponse.json({ ...file, size: file.size.toString() }, { status: 201 });
}

export const POST = api(handlePOST);

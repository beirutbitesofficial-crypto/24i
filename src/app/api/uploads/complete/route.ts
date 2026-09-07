import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";

const schema = z.object({
  clientId: z.string(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  contentId: z.string().optional(),
  key: z.string().startsWith("clients/"),
  originalName: z.string().min(1),
  mimeType: z.string(),
  size: z.string().regex(/^\d+$/),
  checksum: z.string().optional(),
});

export async function POST(req: Request) {
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

  const file = await db.fileObject.create({
    data: {
      ...parsed.data,
      size: BigInt(parsed.data.size),
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

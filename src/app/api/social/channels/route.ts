import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  clientId: z.string().min(1),
  mappings: z.array(z.object({
    channelId: z.string().min(1),
    service: z.string().min(1).max(40),
    name: z.string().max(200).optional(),
    autoPublish: z.boolean().default(true),
  })).max(30),
});

export async function GET() {
  await authorize("clients.read");
  const rows = await db.socialChannel.findMany({
    where: { provider: "BUFFER" },
    orderBy: [{ clientId: "asc" }, { service: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(rows);
}

export async function PUT(req: Request) {
  const user = await authorize("clients.read");
  if (!["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER"].includes(user.role.key)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const client = await db.client.findUnique({ where: { id: parsed.data.clientId }, select: { id: true, brandName: true } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const unique = [...new Map(parsed.data.mappings.map((item) => [item.channelId, item])).values()];

  await db.$transaction(async (tx) => {
    await tx.socialChannel.deleteMany({ where: { clientId: client.id, provider: "BUFFER" } });
    if (unique.length) {
      await tx.socialChannel.createMany({
        data: unique.map((item) => ({
          clientId: client.id,
          provider: "BUFFER",
          channelId: item.channelId,
          service: item.service.toLowerCase(),
          name: item.name,
          active: true,
          autoPublish: item.autoPublish,
        })),
      });
    }
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "SOCIAL_CHANNELS_UPDATED",
        entityType: "Client",
        entityId: client.id,
        newValue: { provider: "BUFFER", channels: unique.map((item) => ({ channelId: item.channelId, service: item.service, autoPublish: item.autoPublish })) },
      },
    });
  });

  return NextResponse.json({ ok: true });
}

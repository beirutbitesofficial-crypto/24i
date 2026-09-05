import { NextResponse } from "next/server";
import { authorize, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { signDownload } from "@/lib/storage";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await db.fileObject.findFirst({ where: { id, deletedAt: null } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await authorize("files.read", file.clientId || undefined);
  const scoped = assignedClientIds(user);
  if (scoped && (!file.clientId || !scoped.includes(file.clientId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.redirect(await signDownload(file.key));
}

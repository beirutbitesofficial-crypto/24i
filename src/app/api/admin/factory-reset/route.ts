import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteStoredObject } from "@/lib/storage";

const schema = z.object({
  password: z.string().min(1).max(128),
  confirm: z.literal("RESET"),
});

// Every table holding agency data. Roles, permissions, admin accounts, agency settings and
// the migration history are intentionally NOT listed and survive the reset.
const DATA_TABLES = [
  "PublishingAttempt", "SocialChannel",
  "ApprovalNote", "Approval", "CarouselSlide", "ContentVersion", "CaptionVersion", "CalendarEntry", "ContentItem",
  "TaskComment", "TaskAssignment", "Task", "Project",
  "FinancialTransaction", "RevenueItem", "Payment", "Invoice",
  "SalaryPayment", "SalaryProfile", "Expense", "ExpenseCategory",
  "ClientPackage", "Package",
  "FileObject", "ClientUser", "Client",
  "Notification", "PushSubscription", "AuditLog",
];

const STORAGE_TIME_BUDGET_MS = 20_000;

async function handlePOST(req: Request) {
  const actor = await requireUser();
  if (actor.role.key !== "ADMIN") return NextResponse.json({ error: "Only an Admin can reset the app" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Type RESET and enter your password to confirm" }, { status: 400 });
  if (!(await verifyPassword(actor.passwordHash, parsed.data.password))) {
    return NextResponse.json({ error: "Wrong password" }, { status: 403 });
  }

  const storedKeys = (await db.fileObject.findMany({ where: { deletedAt: null }, select: { key: true } })).map((f) => f.key);

  const removed = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`TRUNCATE TABLE ${DATA_TABLES.map((t) => `"${t}"`).join(", ")}`);
    const users = await tx.user.deleteMany({ where: { role: { key: { not: "ADMIN" } } } });
    return users.count;
  });

  // Best-effort storage cleanup after the database is already clean. Anything not removed in
  // time (or stored in a different bucket) can be deleted from the storage dashboard.
  let deletedFiles = 0;
  let failedFiles = 0;
  const started = Date.now();
  for (let i = 0; i < storedKeys.length && Date.now() - started < STORAGE_TIME_BUDGET_MS; i += 8) {
    const results = await Promise.allSettled(storedKeys.slice(i, i + 8).map((key) => deleteStoredObject(key)));
    for (const r of results) {
      if (r.status === "fulfilled") deletedFiles++;
      else failedFiles++;
    }
  }
  const leftInStorage = storedKeys.length - deletedFiles;

  await db.auditLog.create({
    data: {
      userId: actor.id,
      action: "FACTORY_RESET",
      entityType: "System",
      entityId: "all",
      newValue: { removedUsers: removed, storageFiles: storedKeys.length, deletedFiles, failedFiles, leftInStorage },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) || null,
    },
  });

  return NextResponse.json({ ok: true, removedUsers: removed, deletedFiles, leftInStorage });
}

export const POST = api(handlePOST);

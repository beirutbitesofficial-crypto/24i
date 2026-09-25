import type { Prisma } from "@prisma/client";
import { db } from "./db";

type Tx = Prisma.TransactionClient;

const STAFF_ROLES = ["ADMIN", "MANAGER", "EDITOR", "SOCIAL_MEDIA_MANAGER"];

// Each check returns an error message, or null when every referenced record is valid.

export async function checkProject(projectId: string | undefined, clientId: string | null | undefined, tx: Tx = db) {
  if (!projectId) return null;
  const project = await tx.project.findUnique({ where: { id: projectId }, select: { clientId: true } });
  if (!project) return "Project not found";
  if (project.clientId !== clientId) return "Project belongs to a different client";
  return null;
}

export async function checkStaff(userIds: string[], tx: Tx = db) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return null;
  const found = await tx.user.count({ where: { id: { in: ids }, status: "ACTIVE", role: { key: { in: STAFF_ROLES } } } });
  return found === ids.length ? null : "One or more assignees are not active team members";
}

export async function checkClients(clientIds: string[], tx: Tx = db) {
  const ids = [...new Set(clientIds)];
  if (!ids.length) return null;
  const found = await tx.client.count({ where: { id: { in: ids } } });
  return found === ids.length ? null : "One or more clients were not found";
}

export async function checkFiles(fileIds: (string | undefined)[], clientId: string, tx: Tx = db) {
  const ids = [...new Set(fileIds.filter((x): x is string => Boolean(x)))];
  if (!ids.length) return null;
  const found = await tx.fileObject.count({ where: { id: { in: ids }, clientId, deletedAt: null } });
  return found === ids.length ? null : "One or more files were not found for this client";
}

export async function checkTask(taskId: string | undefined, clientId: string, tx: Tx = db) {
  if (!taskId) return null;
  const task = await tx.task.findUnique({ where: { id: taskId }, select: { clientId: true } });
  if (!task) return "Task not found";
  return task.clientId === clientId ? null : "Task belongs to a different client";
}

export async function checkContent(contentId: string | undefined, clientId: string, tx: Tx = db) {
  if (!contentId) return null;
  const content = await tx.contentItem.findUnique({ where: { id: contentId }, select: { clientId: true } });
  if (!content) return "Content not found";
  return content.clientId === clientId ? null : "Content belongs to a different client";
}

export async function firstError(...checks: Promise<string | null>[]) {
  return (await Promise.all(checks)).find(Boolean) ?? null;
}

import { hasPermission, type SessionUser } from "./auth";
import { db } from "./db";
import { POST as createContent } from "@/app/api/content/route";
import { POST as submitVersion } from "@/app/api/content/[id]/versions/route";
import { POST as submitCaption } from "@/app/api/content/[id]/captions/route";
import { POST as scheduleContent } from "@/app/api/content/[id]/schedule/route";
import { POST as sendChat } from "@/app/api/chat/[clientId]/route";
import { POST as createScript } from "@/app/api/scripts/route";
import { POST as createTask } from "@/app/api/tasks/route";
import { PATCH as updateTask } from "@/app/api/tasks/[id]/route";
import { POST as review } from "@/app/api/approvals/route";

// Tools the in-app assistant can use. Read tools run straight away and only return what the
// user may see. Action tools never run on the model's say-so: the user confirms each one, and
// it then goes through the same API route (and permission checks) as the normal screens.

type Json = Record<string, unknown>;
type ToolDef = { name: string; description: string; parameters: Json; action?: boolean };

const str = (description: string) => ({ type: "string", description });
const obj = (properties: Json, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });

const CONTENT_TYPES = ["STATIC_POST", "CAROUSEL", "REEL", "STORY", "TIKTOK", "YOUTUBE_SHORT", "FACEBOOK_POST", "LINKEDIN_POST", "ADVERTISEMENT", "OTHER"];

const TOOLS: ToolDef[] = [
  { name: "list_clients", description: "List the client companies this user can see, with their ids.", parameters: obj({ search: str("Optional part of the brand name") }) },
  { name: "list_content", description: "List content items (posts, reels…) with status. Use it to find a contentId.", parameters: obj({ clientId: str("Optional client id"), search: str("Optional words from the title"), status: str("Optional workflow status, e.g. WAITING_CLIENT_APPROVAL, REVISION_REQUESTED, APPROVED, SCHEDULED") }) },
  { name: "get_content", description: "Details of one content item: latest version, caption, approvals, client notes.", parameters: obj({ contentId: str("Content id") }, ["contentId"]) },
  { name: "list_files", description: "Recently uploaded files (videos, images). Use it to find a fileId.", parameters: obj({ clientId: str("Optional client id"), search: str("Optional part of the file name") }) },
  { name: "list_tasks", description: "Tasks. By default the tasks assigned to this user that are not completed.", parameters: obj({ everyone: { type: "boolean", description: "true to list tasks of the whole team (managers)" }, clientId: str("Optional client id") }) },
  { name: "list_scripts", description: "Scripts with their status.", parameters: obj({ clientId: str("Optional client id") }) },
  { name: "list_team", description: "Active team members (not clients) with ids and roles, e.g. to assign a task.", parameters: obj({}) },

  { action: true, name: "submit_version", description: "Send an uploaded video/image as a new version of an existing content item (the client or the social media manager is notified). Social media managers must include a caption.", parameters: obj({ contentId: str("Content id"), fileId: str("File id"), notes: str("Optional notes for the reviewer"), caption: str("Caption (required for social media managers)"), hashtags: str("Optional hashtags") }, ["contentId", "fileId"]) },
  { action: true, name: "create_content", description: "Create a new content item for a client, optionally with an uploaded file sent right away as its first version.", parameters: obj({ clientId: str("Client id"), title: str("Title"), type: { type: "string", enum: CONTENT_TYPES }, platforms: { type: "array", items: { type: "string" }, description: "e.g. [\"INSTAGRAM\"]" }, fileId: str("Optional file id to submit as the first version"), notes: str("Optional notes"), caption: str("Optional caption") }, ["clientId", "title", "type"]) },
  { action: true, name: "submit_caption", description: "Submit a caption for a content item for approval.", parameters: obj({ contentId: str("Content id"), caption: str("Caption text"), hashtags: str("Optional hashtags"), cta: str("Optional call to action") }, ["contentId", "caption"]) },
  { action: true, name: "schedule_content", description: "Set the publishing date and time of a content item.", parameters: obj({ contentId: str("Content id"), scheduledAt: str("ISO date-time with timezone offset, e.g. 2026-10-02T18:00:00+03:00") }, ["contentId", "scheduledAt"]) },
  { action: true, name: "send_message", description: "Send a chat message in a client's conversation. Clients must choose who it is for (toRole).", parameters: obj({ clientId: str("Client id"), body: str("Message text"), toRole: { type: "string", enum: ["MANAGER", "SOCIAL_MEDIA_MANAGER", "EDITOR"], description: "Required when the user is a client" } }, ["clientId", "body"]) },
  { action: true, name: "create_script", description: "Save a script for a client (staff: sent to the client for approval; client: sent to the team).", parameters: obj({ clientId: str("Client id"), title: str("Title"), body: str("Full script") }, ["clientId", "title", "body"]) },
  { action: true, name: "create_task", description: "Create a task and assign it to team members.", parameters: obj({ title: str("Title"), assigneeIds: { type: "array", items: { type: "string" }, description: "User ids from list_team" }, clientId: str("Optional client id"), description: str("Optional details"), priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] }, dueAt: str("Optional ISO due date-time") }, ["title", "assigneeIds"]) },
  { action: true, name: "update_task_status", description: "Change the status of a task.", parameters: obj({ taskId: str("Task id"), status: { type: "string", enum: ["TODO", "IN_PROGRESS", "REVIEW", "REVISION", "WAITING_CLIENT", "COMPLETED"] }, note: str("Optional note") }, ["taskId", "status"]) },
  { action: true, name: "review_content", description: "Client only: approve a content item, or request changes with a note.", parameters: obj({ contentId: str("Content id"), decision: { type: "string", enum: ["APPROVED", "REVISION_REQUESTED"] }, scope: { type: "string", enum: ["VISUAL", "CAPTION", "ALL"], description: "What the decision is about; approvals must be ALL" }, note: str("Required when requesting changes") }, ["contentId", "decision"]) },
];

const STAFF = new Set(["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER", "EDITOR"]);

function allowedTools(user: SessionUser) {
  const role = user.role.key;
  const client = role === "CLIENT";
  return TOOLS.filter((t) => {
    switch (t.name) {
      case "list_team": case "create_task": return STAFF.has(role) && (t.name === "list_team" || hasPermission(user, "tasks.write"));
      case "list_tasks": case "update_task_status": return STAFF.has(role) && hasPermission(user, "tasks.read");
      case "list_files": return hasPermission(user, "files.read") && !client;
      case "submit_version": return hasPermission(user, "content.upload") && !client;
      case "create_content": case "submit_caption": return hasPermission(user, "content.write") && !client;
      case "schedule_content": return hasPermission(user, "content.schedule") && !client;
      case "review_content": return client && hasPermission(user, "content.approve");
      default: return true;
    }
  });
}

export function toolSchemas(user: SessionUser) {
  return allowedTools(user).map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

export const isActionTool = (name: string) => Boolean(TOOLS.find((t) => t.name === name)?.action);
export const canUseTool = (user: SessionUser, name: string) => allowedTools(user).some((t) => t.name === name);

const scope = (user: SessionUser) => (user.role.key === "CLIENT" ? user.clientUsers.map((c) => c.clientId) : undefined);
const inScope = (user: SessionUser, clientId?: unknown) => {
  const ids = scope(user);
  if (typeof clientId === "string" && clientId) return ids ? (ids.includes(clientId) ? { clientId } : { clientId: "__none__" }) : { clientId };
  return ids ? { clientId: { in: ids } } : {};
};
const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const when = (d?: Date | null) => d?.toISOString() ?? null;

export async function runReadTool(user: SessionUser, name: string, args: Json): Promise<unknown> {
  switch (name) {
    case "list_clients":
      return db.client.findMany({ where: { ...(scope(user) ? { id: { in: scope(user)! } } : {}), ...(s(args.search) ? { brandName: { contains: s(args.search), mode: "insensitive" } } : {}) }, select: { id: true, brandName: true, industry: true, status: true }, orderBy: { brandName: "asc" }, take: 50 });
    case "list_content": {
      const rows = await db.contentItem.findMany({
        where: { ...inScope(user, args.clientId), NOT: { platform: { has: "SCRIPT" } }, ...(s(args.search) ? { title: { contains: s(args.search), mode: "insensitive" } } : {}), ...(s(args.status) ? { status: s(args.status) as never } : {}) },
        include: { client: { select: { brandName: true } }, calendar: { select: { scheduledAt: true } } },
        orderBy: { updatedAt: "desc" },
        take: 25,
      });
      const owners = new Map((await db.user.findMany({ where: { id: { in: rows.map((r) => r.ownerId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
      return rows.map((r) => ({ id: r.id, title: r.title, client: r.client.brandName, clientId: r.clientId, type: r.type, status: r.status, visual: r.visualStatus, caption: r.captionStatus, owner: r.ownerId ? owners.get(r.ownerId) ?? null : null, scheduledAt: when(r.calendar?.scheduledAt), updatedAt: when(r.updatedAt) }));
    }
    case "get_content": {
      const r = await db.contentItem.findFirst({
        where: { id: s(args.contentId), ...inScope(user) },
        include: {
          client: { select: { brandName: true } },
          calendar: { select: { scheduledAt: true, publishingStatus: true } },
          versions: { orderBy: { version: "desc" }, take: 1 },
          captions: { orderBy: { version: "desc" }, take: 1 },
          approvals: { orderBy: { createdAt: "desc" }, take: 3, include: { notes: { select: { body: true } } } },
        },
      });
      if (!r) return { error: "Content not found" };
      const fileId = r.versions[0]?.fileId;
      const file = fileId ? await db.fileObject.findUnique({ where: { id: fileId }, select: { originalName: true } }) : null;
      return { id: r.id, title: r.title, client: r.client.brandName, clientId: r.clientId, type: r.type, platforms: r.platform, status: r.status, visual: r.visualStatus, caption: r.captionStatus, scheduledAt: when(r.calendar?.scheduledAt), latestVersion: r.versions[0] ? { version: r.versions[0].version, file: file?.originalName ?? null, notes: r.versions[0].notes } : null, latestCaption: r.captions[0] ? { text: r.captions[0].caption, hashtags: r.captions[0].hashtags } : null, recentDecisions: r.approvals.map((a) => ({ scope: a.scope, state: a.state, notes: a.notes.map((n) => n.body) })) };
    }
    case "list_files": {
      const rows = await db.fileObject.findMany({ where: { deletedAt: null, ...inScope(user, args.clientId), ...(s(args.search) ? { originalName: { contains: s(args.search), mode: "insensitive" } } : {}) }, include: { client: { select: { brandName: true } } }, orderBy: { createdAt: "desc" }, take: 20 });
      return rows.map((f) => ({ id: f.id, name: f.originalName, type: f.mimeType, client: f.client?.brandName ?? null, clientId: f.clientId, uploadedByMe: f.uploadedById === user.id, usedInContentId: f.contentId, uploadedAt: when(f.createdAt) }));
    }
    case "list_tasks": {
      const everyone = args.everyone === true && ["ADMIN", "MANAGER"].includes(user.role.key);
      const rows = await db.task.findMany({
        where: { status: { not: "COMPLETED" }, ...(everyone ? {} : { assignees: { some: { userId: user.id } } }), ...(s(args.clientId) ? { clientId: s(args.clientId) } : {}) },
        include: { client: { select: { brandName: true } }, assignees: { include: { user: { select: { name: true } } } } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 30,
      });
      return rows.map((t) => ({ id: t.id, title: t.title, client: t.client?.brandName ?? null, status: t.status, priority: t.priority, dueAt: when(t.dueAt), assignees: t.assignees.map((a) => a.user.name) }));
    }
    case "list_scripts": {
      const rows = await db.contentItem.findMany({ where: { platform: { has: "SCRIPT" }, ...inScope(user, args.clientId) }, include: { client: { select: { brandName: true } } }, orderBy: { updatedAt: "desc" }, take: 20 });
      return rows.map((r) => ({ id: r.id, title: r.title, client: r.client.brandName, status: r.status }));
    }
    case "list_team":
      return (await db.user.findMany({ where: { status: "ACTIVE", role: { key: { in: [...STAFF] } } }, select: { id: true, name: true, role: { select: { name: true } } }, orderBy: { name: "asc" } })).map((u) => ({ id: u.id, name: u.name, role: u.role.name }));
  }
  return { error: `Unknown tool ${name}` };
}

// A short, human description of an action, shown on the confirm card.
export async function describeAction(user: SessionUser, name: string, a: Json) {
  const content = s(a.contentId) ? await db.contentItem.findFirst({ where: { id: s(a.contentId), ...inScope(user) }, select: { title: true, client: { select: { brandName: true } } } }) : null;
  const client = s(a.clientId) ? await db.client.findFirst({ where: { id: s(a.clientId), ...(scope(user) ? { id: { in: scope(user)! } } : {}) }, select: { brandName: true } }) : null;
  const file = s(a.fileId) ? await db.fileObject.findFirst({ where: { id: s(a.fileId), ...inScope(user) }, select: { originalName: true } }) : null;
  const c = content ? `“${content.title}” (${content.client.brandName})` : "the content item";
  const role: Record<string, string> = { MANAGER: "the manager", SOCIAL_MEDIA_MANAGER: "social media", EDITOR: "the editor" };
  switch (name) {
    case "submit_version": return `Send ${file ? `“${file.originalName}”` : "the file"} as a new version of ${c}${s(a.caption) ? " with a caption" : ""}.`;
    case "create_content": return `Create ${String(a.type || "").toLowerCase().replaceAll("_", " ")} “${s(a.title)}” for ${client?.brandName ?? "the client"}${file ? ` and send “${file.originalName}” as its first version` : ""}.`;
    case "submit_caption": return `Submit this caption for ${c}:\n${s(a.caption)}${s(a.hashtags) ? `\n${s(a.hashtags)}` : ""}`;
    case "schedule_content": return `Schedule ${c} for ${s(a.scheduledAt) ? new Date(String(a.scheduledAt)).toLocaleString("en-GB", { timeZone: "Asia/Beirut", dateStyle: "medium", timeStyle: "short" }) : "?"} (Beirut time).`;
    case "send_message": return `Message ${client?.brandName ?? "the client"}${a.toRole ? ` → ${role[String(a.toRole)] ?? a.toRole}` : ""}:\n${s(a.body)}`;
    case "create_script": return `Save script “${s(a.title)}” for ${client?.brandName ?? "the client"}.`;
    case "create_task": {
      const names = Array.isArray(a.assigneeIds) ? (await db.user.findMany({ where: { id: { in: a.assigneeIds.map(String) } }, select: { name: true } })).map((u) => u.name) : [];
      return `Create task “${s(a.title)}”${names.length ? ` for ${names.join(", ")}` : ""}${client ? ` (${client.brandName})` : ""}${s(a.dueAt) ? `, due ${new Date(String(a.dueAt)).toLocaleString("en-GB", { timeZone: "Asia/Beirut", dateStyle: "medium", timeStyle: "short" })}` : ""}.`;
    }
    case "update_task_status": {
      const task = s(a.taskId) ? await db.task.findUnique({ where: { id: s(a.taskId) }, select: { title: true } }) : null;
      return `Mark task “${task?.title ?? "?"}” as ${String(a.status).toLowerCase().replaceAll("_", " ")}.`;
    }
    case "review_content": return a.decision === "APPROVED" ? `Approve ${c}.` : `Request changes on ${c}${a.scope && a.scope !== "ALL" ? ` (${String(a.scope).toLowerCase()})` : ""}:\n${s(a.note) ?? ""}`;
  }
  return name;
}

async function call(handler: (req: Request, ctx: never) => Promise<Response>, body: unknown, params?: Json) {
  const req = new Request("http://assistant.internal/", { method: body === undefined ? "GET" : name(handler), headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await handler(req, { params: Promise.resolve(params ?? {}) } as never);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error;
    const message = typeof e === "string" ? e : e?.formErrors?.[0] || Object.values(e?.fieldErrors || {}).flat()[0] || "The action failed";
    throw new Error(String(message));
  }
  return data;
}
const name = (handler: unknown) => (handler === updateTask ? "PATCH" : "POST");

const clean = <T extends Json>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;

// Runs a confirmed action through the regular API route, as the signed-in user.
export async function runAction(user: SessionUser, tool: string, a: Json): Promise<{ message: string; link?: string }> {
  switch (tool) {
    case "submit_version":
      await call(submitVersion, clean({ fileId: s(a.fileId), notes: s(a.notes), caption: s(a.caption), hashtags: s(a.hashtags) }), { id: s(a.contentId) });
      return { message: "Version sent.", link: `/content/${s(a.contentId)}` };
    case "create_content": {
      const created = await call(createContent, { clientId: s(a.clientId), title: s(a.title), type: s(a.type), platform: Array.isArray(a.platforms) && a.platforms.length ? a.platforms.map(String) : ["INSTAGRAM"] });
      if (s(a.fileId)) await call(submitVersion, clean({ fileId: s(a.fileId), notes: s(a.notes), caption: s(a.caption) }), { id: created.id });
      return { message: s(a.fileId) ? "Content created and the file was sent." : "Content created.", link: `/content/${created.id}` };
    }
    case "submit_caption":
      await call(submitCaption, clean({ caption: s(a.caption), hashtags: s(a.hashtags), cta: s(a.cta) }), { id: s(a.contentId) });
      return { message: "Caption submitted.", link: `/content/${s(a.contentId)}` };
    case "schedule_content":
      await call(scheduleContent, { scheduledAt: s(a.scheduledAt) }, { id: s(a.contentId) });
      return { message: "Scheduled.", link: `/content/${s(a.contentId)}` };
    case "send_message":
      await call(sendChat, clean({ body: s(a.body), toRole: user.role.key === "CLIENT" ? s(a.toRole) : undefined }), { clientId: s(a.clientId) });
      return { message: "Message sent.", link: user.role.key === "CLIENT" ? "/chat" : `/chat?client=${s(a.clientId)}` };
    case "create_script": {
      const created = await call(createScript, { clientId: s(a.clientId), title: s(a.title), body: s(a.body) });
      return { message: "Script saved.", link: `/scripts#${created.id}` };
    }
    case "create_task":
      await call(createTask, clean({ title: s(a.title), assigneeIds: Array.isArray(a.assigneeIds) ? a.assigneeIds.map(String) : [], clientId: s(a.clientId), description: s(a.description), priority: s(a.priority) || "MEDIUM", category: "General", dueAt: s(a.dueAt) }));
      return { message: "Task created.", link: "/tasks" };
    case "update_task_status":
      await call(updateTask, clean({ status: s(a.status), note: s(a.note) }), { id: s(a.taskId) });
      return { message: "Task updated.", link: "/tasks" };
    case "review_content":
      await call(review, clean({ contentId: s(a.contentId), decision: s(a.decision), scope: a.decision === "APPROVED" ? "ALL" : s(a.scope) || "ALL", note: s(a.note) }));
      return { message: a.decision === "APPROVED" ? "Approved." : "Your notes were sent to the team.", link: `/content/${s(a.contentId)}` };
  }
  throw new Error("Unknown action");
}

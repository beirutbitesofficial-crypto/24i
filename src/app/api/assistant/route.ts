import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/lib/http";
import { hasPermission, requireUser, type SessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AiError, aiConfigured, allowAi, chatCompletion } from "@/lib/ai";
import { canUseTool, describeAction, isActionTool, runAction, runReadTool, toolSchemas } from "@/lib/assistant-tools";

const message = z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) });
const schema = z.union([
  z.object({ messages: z.array(message).min(1).max(40) }),
  z.object({ confirm: z.object({ tool: z.string(), args: z.record(z.string(), z.unknown()) }) }),
]);

const ROLE_HELP: Record<string, string> = {
  ADMIN: "an Admin with full access",
  MANAGER: "a Manager: oversees clients, content, tasks, the team and finance",
  SOCIAL_MEDIA_MANAGER: "a Social Media Manager: writes captions and scripts, sends content to clients for approval, schedules posts",
  EDITOR: "an Editor: edits videos/designs and submits them as versions of content items",
  CLIENT: "a client of the agency: reviews and approves content, writes scripts, chats with the team",
};

function systemPrompt(user: SessionUser) {
  const now = new Date().toLocaleString("en-GB", { timeZone: "Asia/Beirut", dateStyle: "full", timeStyle: "short" });
  return [
    `You are the built-in assistant of 24i Production, a social media agency app. You help ${user.name}, who is ${ROLE_HELP[user.role.key] || user.role.name}.`,
    `Now in Beirut: ${now} (UTC+03:00). Interpret dates and times in Beirut time.`,
    "Reply in the user's language and style: Lebanese Arabic, Arabizi (e.g. 'kifak, tamem') or English — match what they write. Keep replies short and practical.",
    "Use the tools to look things up. Never invent ids: find clients, content, files, tasks and people with the list tools first. If several match, ask which one.",
    "To do something, call the matching action tool with complete arguments. The app shows the user a Confirm button before anything happens, so do not ask 'are you sure' yourself.",
    "When the user attached a file, its fileId and client are given in the message. To send it to a client, find the content item it belongs to (list_content); if none fits, create one with create_content including the fileId.",
    "You can also write captions, hashtags, scripts and ideas directly in the chat.",
    "You only have the tools listed; if something is not possible, say where in the app to do it.",
  ].join("\n");
}

type ToolCall = { id: string; function: { name: string; arguments: string } };

async function handlePOST(req: Request) {
  const user = await requireUser();
  if (!aiConfigured()) return NextResponse.json({ error: "AI is not set up yet. Ask the admin to add OPENAI_API_KEY." }, { status: 503 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if ("confirm" in parsed.data) {
    const { tool, args } = parsed.data.confirm;
    if (!isActionTool(tool) || !canUseTool(user, tool)) return NextResponse.json({ error: "You are not allowed to do that" }, { status: 403 });
    try {
      return NextResponse.json(await runAction(user, tool, args));
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "The action failed" }, { status: 400 });
    }
  }

  if (!allowAi(user.id, 80)) return NextResponse.json({ error: "You reached the hourly AI limit. Try again later." }, { status: 429 });

  const messages: Record<string, unknown>[] = [{ role: "system", content: systemPrompt(user) }, ...parsed.data.messages.slice(-20)];
  const tools = toolSchemas(user);
  try {
    for (let round = 0; round < 6; round++) {
      const data = await chatCompletion({ messages, tools, tool_choice: "auto", temperature: 0.3, max_tokens: 1200 });
      const reply = data?.choices?.[0]?.message;
      const calls: ToolCall[] = reply?.tool_calls || [];
      if (!calls.length) return NextResponse.json({ reply: reply?.content?.trim() || "…" });

      const action = calls.find((c) => isActionTool(c.function.name));
      if (action) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(action.function.arguments || "{}"); } catch { /* keep empty */ }
        if (!canUseTool(user, action.function.name)) return NextResponse.json({ reply: "You don't have permission to do that." });
        return NextResponse.json({
          reply: reply?.content?.trim() || "",
          pending: { tool: action.function.name, args, summary: await describeAction(user, action.function.name, args) },
        });
      }

      messages.push({ role: "assistant", content: reply?.content ?? null, tool_calls: calls });
      for (const call of calls) {
        let result: unknown;
        try {
          const args = JSON.parse(call.function.arguments || "{}");
          result = canUseTool(user, call.function.name) ? await runReadTool(user, call.function.name, args) : { error: "Not allowed" };
        } catch (error) {
          result = { error: error instanceof Error ? error.message : "Tool failed" };
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 12000) });
      }
    }
    return NextResponse.json({ reply: "That took too many steps. Can you be more specific?" });
  } catch (error) {
    if (error instanceof AiError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

// Clients the user can attach files for (used by the upload picker in the assistant).
async function handleGET() {
  const user = await requireUser();
  const ids = user.role.key === "CLIENT" ? user.clientUsers.map((c) => c.clientId) : undefined;
  const clients = hasPermission(user, "files.write")
    ? await db.client.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, brandName: true }, orderBy: { brandName: "asc" } })
    : [];
  return NextResponse.json({ clients });
}

export const GET = api(handleGET);
export const POST = api(handlePOST);

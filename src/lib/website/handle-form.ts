import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";
import { deliver, deliveryConfigured, rateLimited } from "./deliver";

type Built = { subject: string; replyTo: string; fields: Record<string, string | undefined> };

export async function handleForm<T>(req: NextRequest, kind: "contact" | "booking", schema: ZodType<T>, build: (data: T) => Built) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (rateLimited(ip)) return NextResponse.json({ ok: false, error: "Too many requests. Please try again in a few minutes." }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    // A filled honeypot is a bot: pretend success and drop it.
    if ("company_website" in fieldErrors) return NextResponse.json({ ok: true });
    return NextResponse.json({ ok: false, error: "Please check the highlighted fields.", fieldErrors }, { status: 422 });
  }

  const message = build(parsed.data);
  if (!deliveryConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[${kind}] form delivery not configured; submission logged only`, message);
      return NextResponse.json({ ok: true });
    }
    console.error(`[${kind}] form delivery is not configured (set RESEND_API_KEY + FORM_TO_EMAIL or FORM_WEBHOOK_URL)`);
    return NextResponse.json({ ok: false, error: "We couldn't send this right now. Please reach us directly." }, { status: 503 });
  }

  try {
    await deliver({ ...message, kind });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[${kind}] delivery failed`, err);
    return NextResponse.json({ ok: false, error: "We couldn't send this right now. Please try again or reach us directly." }, { status: 502 });
  }
}

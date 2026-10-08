import "server-only";

type Delivery = { subject: string; replyTo: string; fields: Record<string, string | undefined>; kind: "contact" | "booking" };

const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function deliveryConfigured() {
  return Boolean((process.env.RESEND_API_KEY && process.env.FORM_TO_EMAIL) || process.env.FORM_WEBHOOK_URL);
}

/** Sends a form submission to every configured channel. Throws if a configured channel fails. */
export async function deliver({ subject, replyTo, fields, kind }: Delivery) {
  const rows = Object.entries(fields).filter(([, v]) => v);
  const tasks: Promise<void>[] = [];

  if (process.env.RESEND_API_KEY && process.env.FORM_TO_EMAIL) {
    const html = `<h2>${escapeHtml(subject)}</h2><table cellpadding="6">${rows
      .map(([k, v]) => `<tr><td><b>${escapeHtml(k)}</b></td><td>${escapeHtml(v!).replace(/\n/g, "<br>")}</td></tr>`)
      .join("")}</table>`;
    const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
    tasks.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.FORM_FROM_EMAIL || "24i Website <onboarding@resend.dev>",
          to: process.env.FORM_TO_EMAIL.split(",").map((s) => s.trim()),
          reply_to: replyTo,
          subject,
          html,
          text,
        }),
        signal: AbortSignal.timeout(10_000),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Resend responded ${r.status}: ${await r.text()}`);
      }),
    );
  }

  if (process.env.FORM_WEBHOOK_URL) {
    tasks.push(
      fetch(process.env.FORM_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: kind, subject, submittedAt: new Date().toISOString(), ...Object.fromEntries(rows) }),
        signal: AbortSignal.timeout(10_000),
      }).then((r) => {
        if (!r.ok) throw new Error(`Webhook responded ${r.status}`);
      }),
    );
  }

  await Promise.all(tasks);
}

const hits = new Map<string, number[]>();
/** Best-effort per-instance rate limit: 5 submissions per 10 minutes per IP. */
export function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 5;
}

"use client";

import { FormEvent, useState } from "react";

type Settings = { companyName: string; currency: "USD"; timezone: string; defaultLanguage: "EN" | "AR" };

export function SettingsForm({ initial }: { initial: Settings }) {
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyName: f.get("companyName"), currency: "USD", timezone: f.get("timezone"), defaultLanguage: f.get("defaultLanguage") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save settings");
      setMessage("Settings saved.");
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not save settings"); }
    finally { setBusy(false); }
  }

  async function sendTestNotification() {
    setTestBusy(true); setMessage("");
    try {
      const res = await fetch("/api/push/test-all", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send test notification");
      setMessage(`Test sent to ${data.activeUsers} active users. ${data.subscriptions} device subscriptions found.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not send test notification");
    } finally {
      setTestBusy(false);
    }
  }

  return <div className="management-stack">
    <section className="panel"><div className="section-head"><div><span className="eyebrow">AGENCY</span><h2>General settings</h2></div><span className="muted">Sensitive secrets stay in Hostinger environment variables</span></div>{message&&<div className="notice">{message}</div>}<form className="form-grid compact-form" onSubmit={submit}><label>Company name<input name="companyName" defaultValue={initial.companyName} required/></label><label>Currency<input value="USD" disabled readOnly/></label><label>Timezone<input name="timezone" defaultValue={initial.timezone} required/></label><label>Default language<select name="defaultLanguage" defaultValue={initial.defaultLanguage}><option value="EN">English</option><option value="AR">Arabic</option></select></label><button disabled={busy}>{busy?"Saving…":"Save settings"}</button></form></section>
    <section className="panel"><div className="section-head"><div><span className="eyebrow">PUSH</span><h2>Test notifications</h2></div><span className="muted">Admin only</span></div><p className="muted">Send one test push to every active user. Only devices that previously allowed notifications will receive the iPhone push.</p><button type="button" disabled={testBusy} onClick={() => void sendTestNotification()}>{testBusy ? "Sending…" : "Send test notification to all users"}</button></section>
  </div>;
}

"use client";

import { FormEvent, useState } from "react";
import { CreatePanel, Notice } from "@/components/ui";

export function ClientManager() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      brandName: form.get("brandName"),
      industry: form.get("industry") || undefined,
      contactName: form.get("contactName"),
      phone: form.get("phone") || undefined,
      whatsapp: form.get("whatsapp") || undefined,
      email: form.get("email"),
      website: form.get("website") || undefined,
      instagram: form.get("instagram") || undefined,
      status: form.get("status"),
      notes: form.get("notes") || undefined,
    };
    try {
      const res = await fetch("/api/clients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not create client");
      setMessage("Client created.");
      window.location.reload();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not create client"); }
    finally { setBusy(false); }
  }

  return <CreatePanel title="Add client" hint="Create a new brand profile"><Notice message={message} /><form className="form-grid compact-form" onSubmit={submit}>
    <label>Brand name<input name="brandName" required /></label>
    <label>Industry<input name="industry" /></label>
    <label>Contact name<input name="contactName" required /></label>
    <label>Email<input name="email" type="email" required /></label>
    <label>Phone<input name="phone" /></label>
    <label>WhatsApp<input name="whatsapp" /></label>
    <label>Website<input name="website" /></label>
    <label>Instagram<input name="instagram" /></label>
    <label>Status<select name="status" defaultValue="LEAD"><option value="LEAD">Lead</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="PENDING_PAYMENT">Pending payment</option><option value="CONTRACT_ENDING">Contract ending</option><option value="INACTIVE">Inactive</option></select></label>
    <label className="full-field">Notes<textarea name="notes" rows={3} /></label>
    <button disabled={busy}>{busy ? "Creating…" : "Create client"}</button>
  </form></CreatePanel>;
}

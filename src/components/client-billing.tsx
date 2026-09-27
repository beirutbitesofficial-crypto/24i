"use client";

import { useState } from "react";
import { Badge } from "@/components/ui";

export type PackageOption = { id: string; name: string; price: string; reels: number; posts: number };

export const packageLabel = (p: PackageOption) => `${p.name} · ${p.reels} reels + ${p.posts} posts · $${p.price}`;

// Package + payment inputs shared by the "Create user" and "Add client" forms.
export function PackageFields({ packages }: { packages: PackageOption[] }) {
  const [packageId, setPackageId] = useState(packages[0]?.id || "");
  return <>
    <label>Package<select name="packageId" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
      {packages.map((p) => <option key={p.id} value={p.id}>{packageLabel(p)}</option>)}
      <option value="">No package yet</option>
    </select></label>
    <label>Payment<select name="paid" defaultValue="false" disabled={!packageId}>
      <option value="false">Not paid yet</option>
      <option value="true">Paid</option>
    </select></label>
  </>;
}

export function readPackageFields(form: FormData) {
  const packageId = String(form.get("packageId") || "");
  return packageId ? { packageId, paid: form.get("paid") === "true" } : {};
}

type Summary = { packageName: string | null; reels: number; posts: number; price: string | null; status: "PAID" | "PARTIALLY_PAID" | "UNPAID" | null; due: string };

async function post(clientId: string, body: unknown) {
  const res = await fetch(`/api/clients/${clientId}/billing`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
}

export function PackageCell({ clientId, summary, packages, canEdit }: { clientId: string; summary: Summary; packages: PackageOption[]; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError("");
    try { await post(clientId, { action: "assign", ...readPackageFields(f) }); window.location.reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Request failed"); setBusy(false); }
  }

  if (editing) return <form className="billing-edit" onSubmit={save}>
    <PackageFields packages={packages} />
    {error && <small className="billing-error">{error}</small>}
    <span className="billing-actions"><button disabled={busy}>{busy ? "Saving…" : "Save"}</button><button type="button" className="ghost" onClick={() => setEditing(false)}>Cancel</button></span>
  </form>;

  return <span className="billing-cell">
    {summary.packageName ? <><b>{summary.packageName}</b><small>{summary.reels} reels · {summary.posts} posts · ${summary.price}/mo</small></> : <span className="muted">No package</span>}
    {canEdit && <button type="button" className="link-button" onClick={() => setEditing(true)}>{summary.packageName ? "Change" : "Set package"}</button>}
  </span>;
}

export function PaymentCell({ clientId, summary, canPay }: { clientId: string; summary: Summary; canPay: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function markPaid() {
    if (!window.confirm(`Record a payment of $${Number(summary.due).toLocaleString()} and mark this client as paid?`)) return;
    setBusy(true); setError("");
    try { await post(clientId, { action: "markPaid" }); window.location.reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Request failed"); setBusy(false); }
  }

  if (!summary.status) return <span className="muted">—</span>;
  const label = summary.status === "PAID" ? "Paid" : summary.status === "PARTIALLY_PAID" ? "Partly paid" : "Not paid";
  return <span className="billing-cell">
    <Badge value={summary.status} label={label} />
    {summary.status !== "PAID" && <small>${Number(summary.due).toLocaleString()} due</small>}
    {canPay && summary.status !== "PAID" && <button type="button" className="link-button" disabled={busy} onClick={markPaid}>{busy ? "Saving…" : "Mark as paid"}</button>}
    {error && <small className="billing-error">{error}</small>}
  </span>;
}

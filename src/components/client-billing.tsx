"use client";

import { FormEvent, useState } from "react";
import { Badge } from "@/components/ui";

export type PackageOption = { id: string; name: string; price: string; reels: number; posts: number };
export type BillingSummary = { packageName: string | null; reels: number; posts: number; price: string | null; status: "PAID" | "PARTIALLY_PAID" | "UNPAID" | null; due: string };

const CUSTOM = "__custom";
const MONEY = "\\d+(\\.\\d{1,2})?";

export const packageLabel = (p: PackageOption) => `${p.name} · ${p.reels} reels + ${p.posts} posts · $${p.price}`;

// Package + payment inputs shared by "Create user", "Add client" and the package editors.
export function PackageFields({ packages, allowNone = true, changing = false }: { packages: PackageOption[]; allowNone?: boolean; changing?: boolean }) {
  const [packageId, setPackageId] = useState(packages[0]?.id || CUSTOM);
  const [payment, setPayment] = useState("UNPAID");
  const selected = packages.find((p) => p.id === packageId);
  const price = packageId === CUSTOM ? null : selected?.price;
  return <>
    <label>Package<select name="packageId" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
      {packages.map((p) => <option key={p.id} value={p.id}>{packageLabel(p)}</option>)}
      <option value={CUSTOM}>Custom package…</option>
      {allowNone && <option value="">No package yet</option>}
    </select></label>
    {packageId === CUSTOM && <div className="custom-package">
      <label>Reels / month<input name="customReels" type="number" min="0" max="1000" required defaultValue="8" /></label>
      <label>Posts / month<input name="customPosts" type="number" min="0" max="1000" required defaultValue="8" /></label>
      <label>Price / month (USD)<input name="customPrice" inputMode="decimal" pattern={MONEY} title="Amount such as 450 or 450.50" required placeholder="450" /></label>
    </div>}
    {packageId && <label>Payment<select name="payment" value={payment} onChange={(e) => setPayment(e.target.value)}>
      <option value="UNPAID">{changing ? "Keep payments as recorded" : "Not paid yet"}</option>
      <option value="PAID">Paid in full</option>
      <option value="PARTIAL">Partly paid</option>
    </select></label>}
    {packageId && payment === "PARTIAL" && <label>{changing ? "Total paid this month (USD)" : "Amount paid (USD)"}<input name="amount" inputMode="decimal" pattern={MONEY} title="Amount such as 150 or 150.50" required placeholder={price ? `Less than ${price}` : "150"} /></label>}
  </>;
}

export function readPackageFields(form: FormData) {
  const packageId = String(form.get("packageId") || "");
  if (!packageId) return {};
  const payment = String(form.get("payment") || "UNPAID");
  return {
    billing: {
      ...(packageId === CUSTOM
        ? { custom: { reels: Number(form.get("customReels") || 0), posts: Number(form.get("customPosts") || 0), price: String(form.get("customPrice") || "").trim() } }
        : { packageId }),
      payment,
      ...(payment === "PARTIAL" ? { amount: String(form.get("amount") || "").trim() } : {}),
    },
  };
}

async function post(clientId: string, body: unknown) {
  const res = await fetch(`/api/clients/${clientId}/billing`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
}

export function PackageCell({ clientId, summary, packages, canEdit }: { clientId: string; summary?: BillingSummary; packages: PackageOption[]; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await post(clientId, { action: "assign", ...readPackageFields(new FormData(e.currentTarget)).billing }); window.location.reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Request failed"); setBusy(false); }
  }

  if (editing) return <form className="billing-edit" onSubmit={save}>
    <PackageFields packages={packages} allowNone={false} changing={Boolean(summary?.packageName)} />
    {summary?.packageName && <small className="muted">This corrects this month&apos;s invoice — nothing is billed twice.</small>}
    {error && <small className="billing-error">{error}</small>}
    <span className="billing-actions"><button disabled={busy}>{busy ? "Saving…" : "Save"}</button><button type="button" className="ghost" onClick={() => setEditing(false)}>Cancel</button></span>
  </form>;

  return <span className="billing-cell">
    {summary?.packageName ? <><b>{summary.packageName}</b><small>{summary.reels} reels · {summary.posts} posts · ${summary.price}/mo</small></> : <span className="muted">No package</span>}
    {canEdit && <button type="button" className="link-button" onClick={() => setEditing(true)}>{summary?.packageName ? "Change" : "Set package"}</button>}
  </span>;
}

export function PaymentCell({ clientId, summary, canPay }: { clientId: string; summary?: BillingSummary; canPay: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amount = String(new FormData(e.currentTarget).get("amount") || "").trim();
    setBusy(true); setError("");
    try { await post(clientId, { action: "pay", ...(amount ? { amount } : {}) }); window.location.reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Request failed"); setBusy(false); }
  }

  if (!summary?.status) return <span className="muted">—</span>;
  const label = summary.status === "PAID" ? "Paid" : summary.status === "PARTIALLY_PAID" ? "Partly paid" : "Not paid";
  const due = Number(summary.due);
  return <span className="billing-cell">
    <Badge value={summary.status} label={label} />
    {summary.status !== "PAID" && <small>${due.toLocaleString()} due</small>}
    {canPay && summary.status !== "PAID" && (open
      ? <form className="billing-edit" onSubmit={pay}>
          <label>Amount received (USD)<input name="amount" inputMode="decimal" pattern={MONEY} required defaultValue={summary.due.replace(/\.00$/, "")} /></label>
          {error && <small className="billing-error">{error}</small>}
          <span className="billing-actions"><button disabled={busy}>{busy ? "Saving…" : "Record"}</button><button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button></span>
        </form>
      : <button type="button" className="link-button" onClick={() => setOpen(true)}>Record payment</button>)}
  </span>;
}

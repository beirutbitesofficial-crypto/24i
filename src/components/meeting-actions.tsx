"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { id: string; status: string; waConfirmed: string; waDeclined: string; ar?: boolean };

// Confirm / decline a website meeting request. If WhatsApp isn't sent automatically, offers a
// one-tap link that opens WhatsApp with the message to the client already written.
export function MeetingActions({ id, status, waConfirmed, waDeclined, ar = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState<string | null>(null);

  async function decide(action: "confirm" | "decline") {
    if (action === "decline" && !window.confirm(ar ? "رفض هذا الاجتماع؟" : "Decline this meeting request?")) return;
    setBusy(true);
    setMessage("");
    setLink(null);
    try {
      const res = await fetch(`/api/meetings/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : (ar ? "تعذّر الحفظ" : "Could not save"));
      if (data.whatsappSent) setMessage(ar ? "تم إرسال رسالة واتساب للعميل." : "Client notified on WhatsApp.");
      else {
        setMessage(ar ? "تم الحفظ. أرسل الرسالة للعميل على واتساب:" : "Saved. Send the client the WhatsApp message:");
        setLink(data.waLink);
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const wa = status === "CONFIRMED" ? waConfirmed : status === "DECLINED" ? waDeclined : null;
  return <div className="meeting-actions" style={{ display: "grid", gap: 8, minWidth: 180 }}>
    {status !== "CONFIRMED" && <button type="button" disabled={busy} onClick={() => decide("confirm")}>{ar ? "تأكيد" : "Confirm"}</button>}
    {status !== "DECLINED" && <button type="button" disabled={busy} className="secondary" onClick={() => decide("decline")}>{ar ? "رفض" : "Decline"}</button>}
    {message && <small className="muted">{message}</small>}
    {(link || wa) && <a className="button secondary" href={link || wa!} target="_blank" rel="noopener noreferrer">{ar ? "واتساب العميل" : "WhatsApp client"} ↗</a>}
  </div>;
}

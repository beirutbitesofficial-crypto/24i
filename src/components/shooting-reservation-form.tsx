"use client";

import { FormEvent, useState } from "react";

type ClientOption = { id: string; brandName: string };

export function ShootingReservationForm({ clients, ar = false }: { clients: ClientOption[]; ar?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const startValue = String(data.get("startAt") || "");
    const endValue = String(data.get("endAt") || "");
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/shooting-reservations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: data.get("clientId"),
          title: data.get("title"),
          startAt: startValue ? new Date(startValue).toISOString() : undefined,
          endAt: endValue ? new Date(endValue).toISOString() : undefined,
          location: data.get("location") || undefined,
          notes: data.get("notes") || undefined,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = typeof result.error === "string" ? result.error : result.error?.formErrors?.[0] || "Could not reserve shooting day";
        throw new Error(error);
      }
      setMessage(ar ? "تم حجز يوم التصوير وإضافته للتقويم." : "Shooting day reserved and added to the calendar.");
      form.reset();
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (ar ? "تعذّر حجز يوم التصوير." : "Could not reserve shooting day."));
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel">
    <span className="eyebrow">{ar ? "حجز تصوير" : "SHOOTING RESERVATION"}</span>
    <h2>{ar ? "احجز يوم تصوير" : "Reserve a shooting day"}</h2>
    {message && <div className="notice">{message}</div>}
    <form className="form-grid compact-form" onSubmit={submit}>
      <label>{ar ? "العميل" : "Client"}
        <select name="clientId" required>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.brandName}</option>)}
        </select>
      </label>
      <label>{ar ? "اسم التصوير" : "Shooting title"}<input name="title" required defaultValue="Shooting day" /></label>
      <label>{ar ? "البداية" : "Start"}<input name="startAt" type="datetime-local" required /></label>
      <label>{ar ? "النهاية" : "End"}<input name="endAt" type="datetime-local" required /></label>
      <label>{ar ? "المكان" : "Location"}<input name="location" placeholder={ar ? "الموقع / العنوان" : "Location / address"} /></label>
      <label className="full-field">{ar ? "ملاحظات" : "Notes"}<textarea name="notes" rows={4} placeholder={ar ? "تفاصيل التصوير، معدات، أفكار…" : "Shooting details, equipment, ideas…"} /></label>
      <button className="full-field" disabled={busy || !clients.length}>{busy ? (ar ? "جارٍ الحجز…" : "Reserving…") : (ar ? "حجز يوم التصوير" : "Reserve shooting day")}</button>
    </form>
  </section>;
}

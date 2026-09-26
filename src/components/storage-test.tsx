"use client";

import { useState } from "react";

type Check = { step: string; ok: boolean; detail: string };

export function StorageTest({ ar = false }: { ar?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true); setError(""); setChecks(null);
    try {
      const res = await fetch("/api/admin/storage-test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Test failed");
      setChecks(data.checks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel">
    <div className="section-head"><div><span className="eyebrow">{ar ? "التخزين" : "Storage"}</span><h2>{ar ? "اختبار التخزين" : "Test storage connection"}</h2></div><span className="badge badge-neutral">{ar ? "للمدير فقط" : "Admin only"}</span></div>
    <p className="muted">{ar ? "بيجرّب الإعدادات، المفاتيح، رابط الرفع والـCORS، وبيقلك وين المشكلة بالضبط." : "Checks the settings, keys, upload link and CORS, and tells you exactly which step fails."}</p>
    {error && <div className="notice error" role="alert">{error}</div>}
    {checks && <div className="list">{checks.map((c) => <div className="row" key={c.step}>
      <span className="row-main"><b>{c.ok ? "✅" : "❌"} {c.step}</b><span style={{ whiteSpace: "normal" }}>{c.detail}</span></span>
    </div>)}</div>}
    <button type="button" className="secondary" disabled={busy} onClick={() => void run()}>{busy ? (ar ? "عم يجرّب…" : "Testing…") : (ar ? "جرّب التخزين" : "Run storage test")}</button>
  </section>;
}

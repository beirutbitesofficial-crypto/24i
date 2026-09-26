"use client";

import { useState } from "react";

export function RetryPublish({ contentId, ar = false }: { contentId: string; ar?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function retry() {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/content/${contentId}/publish`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Retry failed");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
      setBusy(false);
    }
  }
  return <div className="compact-form">
    {error && <div className="notice error" role="alert">{error}</div>}
    <button type="button" className="secondary" disabled={busy} onClick={() => void retry()}>{busy ? (ar ? "عم يعيد النشر…" : "Retrying…") : (ar ? "أعد محاولة النشر" : "Retry publishing")}</button>
  </div>;
}

"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

export function LanguageToggle({ language }: { language: "EN" | "AR" }) {
  const [busy, setBusy] = useState(false);
  const ar = language === "AR";

  async function toggle() {
    setBusy(true);
    const next = ar ? "EN" : "AR";
    try {
      const res = await fetch("/api/me/language", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: next }),
      });
      if (!res.ok) throw new Error("Language update failed");
      document.documentElement.lang = next === "AR" ? "ar" : "en";
      document.documentElement.dir = next === "AR" ? "rtl" : "ltr";
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return <button type="button" className="secondary pill" disabled={busy} onClick={() => void toggle()} aria-label={ar ? "Switch to English" : "التبديل إلى العربية"}>
    <Icon name="globe" size={16} />
    <span>{busy ? "…" : ar ? "English" : "العربية"}</span>
  </button>;
}

"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

export function LanguageToggle({ language }: { language: "EN" | "AR" }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      await fetch("/api/me/language", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: language === "EN" ? "AR" : "EN" }) });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }
  return <button className="secondary pill" disabled={busy} onClick={() => void toggle()}><Icon name="globe" size={16} />{language === "EN" ? "العربية" : "English"}</button>;
}

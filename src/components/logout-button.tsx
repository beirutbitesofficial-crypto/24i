"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

export function LogoutButton({ label = "Sign out" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } finally {
      setBusy(false);
    }
  }
  return <button type="button" className="icon-button" title={label} aria-label={label} disabled={busy} onClick={() => void logout()}><Icon name="logout" /></button>;
}

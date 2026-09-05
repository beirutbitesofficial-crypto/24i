"use client";

import { useState } from "react";

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
  return <button type="button" className="logout-button" disabled={busy} onClick={() => void logout()}>{busy ? "…" : label}</button>;
}

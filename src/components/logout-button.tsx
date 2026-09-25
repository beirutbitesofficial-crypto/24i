"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

export function LogoutButton({ label = "Sign out", variant = "text" }: { label?: string; variant?: "text" | "icon" }) {
  const [busy, setBusy] = useState(false);

  async function currentPushEndpoint() {
    if (!("serviceWorker" in navigator)) return undefined;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager?.getSubscription();
      return subscription?.endpoint;
    } catch {
      return undefined;
    }
  }

  async function logout() {
    setBusy(true);
    try {
      // Unregister this device's push subscription so a signed-out device stops receiving alerts.
      const pushEndpoint = await currentPushEndpoint();
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pushEndpoint }),
      });
      window.location.href = "/";
    } finally {
      setBusy(false);
    }
  }

  if (variant === "icon") {
    return <button type="button" className="icon-button" title={label} aria-label={label} disabled={busy} onClick={() => void logout()}><Icon name="logout" /></button>;
  }
  return <button type="button" className="logout-button" disabled={busy} onClick={() => void logout()}>{busy ? "…" : label}</button>;
}

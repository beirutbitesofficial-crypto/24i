"use client";

import { useState } from "react";

export function LogoutButton({ label = "Sign out" }: { label?: string }) {
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

  return <button type="button" className="logout-button" disabled={busy} onClick={() => void logout()}>{busy ? "…" : label}</button>;
}

"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

export function LogoutButton({ label = "Sign out", variant = "text" }: { label?: string; variant?: "text" | "icon" }) {
  const [busy, setBusy] = useState(false);

  async function currentPushEndpoint() {
    if (!("serviceWorker" in navigator)) return undefined;
    try {
      // serviceWorker.ready never settles when no service worker is active (common in iPhone
      // Safari), so cap the wait; signing out must never depend on push being available.
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1500)),
      ]);
      const subscription = await registration?.pushManager?.getSubscription();
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
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pushEndpoint }),
      });
      if (!res.ok) throw new Error(`Sign out failed (${res.status})`);
      window.location.replace("/");
    } catch {
      setBusy(false);
      window.alert(label === "Sign out" ? "Could not sign out. Check your connection and try again." : "تعذّر تسجيل الخروج. تأكد من الاتصال وحاول مجدداً.");
    }
  }

  if (variant === "icon") {
    return <button type="button" className="icon-button" title={label} aria-label={label} disabled={busy} onClick={() => void logout()}><Icon name="logout" /></button>;
  }
  return <button type="button" className="logout-button" disabled={busy} onClick={() => void logout()}>{busy ? "…" : label}</button>;
}

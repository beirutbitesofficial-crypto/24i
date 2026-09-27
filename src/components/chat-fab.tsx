"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui";

const POLL_MS = 30_000;

// Floating chat button shown on every page, with the number of unread messages.
export function ChatFab({ label }: { label: string }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/chat/unread", { cache: "no-store" });
        if (res.ok && alive) setUnread((await res.json()).unread || 0);
      } catch { /* offline: keep the last count */ }
    };
    void load();
    const timer = setInterval(load, POLL_MS);
    window.addEventListener("chat:read", load);
    document.addEventListener("visibilitychange", load);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("chat:read", load); document.removeEventListener("visibilitychange", load); };
  }, [pathname]);

  if (pathname?.startsWith("/chat")) return null;
  return <a href="/chat" className="chat-fab" aria-label={unread ? `${label} (${unread})` : label} title={label}>
    <Icon name="chat" size={24} />
    {unread > 0 && <span className="chat-fab-count">{unread > 99 ? "99+" : unread}</span>}
  </a>;
}

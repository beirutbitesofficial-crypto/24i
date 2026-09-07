"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/logout-button";

type Item = { href: string; label: string };

const icons: Record<string, string> = {
  "/": "⌂",
  "/notifications": "🔔",
  "/users": "👥",
  "/clients": "🤝",
  "/projects": "📁",
  "/tasks": "✓",
  "/content": "▶",
  "/calendar": "📅",
  "/files": "🗂",
  "/finance": "$",
  "/reports": "📊",
  "/audit": "🛡",
  "/settings": "⚙",
};

export function BurgerMenu({ items, userName, roleName, signOutLabel, ar = false }: { items: Item[]; userName: string; roleName: string; signOutLabel: string; ar?: boolean }) {
  const [open, setOpen] = useState(false);
  const [navigating, setNavigating] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const item of items) {
        if (item.href !== pathname) router.prefetch(item.href);
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [items, pathname, router]);

  useEffect(() => {
    setNavigating(null);
    setOpen(false);
  }, [pathname]);

  return <>
    <button className="burger-button" aria-label={ar ? "فتح القائمة" : "Open menu"} aria-expanded={open} onClick={() => setOpen(true)}>
      <span /><span /><span />
    </button>
    {open && <button className="burger-backdrop" aria-label={ar ? "إغلاق القائمة" : "Close menu"} onClick={() => setOpen(false)} />}
    <aside className={`burger-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="burger-drawer-head">
        <div><div className="brand">24i</div><small>{ar ? "مساحة العمل" : "Workspace"}</small></div>
        <button className="drawer-close" aria-label={ar ? "إغلاق القائمة" : "Close menu"} onClick={() => setOpen(false)}>×</button>
      </div>
      <nav className="burger-nav" aria-label={ar ? "القائمة الرئيسية" : "Main navigation"}>
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const pending = navigating === item.href;
          return <Link
            key={item.href}
            href={item.href}
            prefetch
            className={`${active ? "active" : ""}${pending ? " pending" : ""}`}
            onPointerEnter={() => router.prefetch(item.href)}
            onTouchStart={() => router.prefetch(item.href)}
            onClick={() => {
              if (!active) setNavigating(item.href);
              setOpen(false);
            }}
          >
            <span className="nav-icon" aria-hidden="true">{icons[item.href] || "•"}</span>
            <span className="nav-label">{item.label}</span>
            {pending && <span className="nav-spinner" aria-hidden="true" />}
          </Link>;
        })}
      </nav>
      <div className="drawer-account">
        <div className="drawer-user"><b>{userName}</b><small>{roleName}</small></div>
        <LogoutButton label={signOutLabel} />
      </div>
    </aside>
  </>;
}

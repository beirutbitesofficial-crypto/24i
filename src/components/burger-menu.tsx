"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  const pathname = usePathname();

  return <>
    <button className="burger-button" aria-label={ar ? "فتح القائمة" : "Open menu"} aria-expanded={open} onClick={() => setOpen(true)}>
      <span /><span /><span />
    </button>
    {open && <button className="burger-backdrop" aria-label={ar ? "إغلاق القائمة" : "Close menu"} onClick={() => setOpen(false)} />}
    <aside className={`burger-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="burger-drawer-head">
        <div><div className="brand">24i</div><small>{ar ? "نظام إدارة العمل" : "Agency workspace"}</small></div>
        <button className="drawer-close" aria-label={ar ? "إغلاق القائمة" : "Close menu"} onClick={() => setOpen(false)}>×</button>
      </div>
      <nav className="burger-nav" aria-label={ar ? "القائمة الرئيسية" : "Main navigation"}>
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={() => setOpen(false)}>
            <span className="nav-icon" aria-hidden="true">{icons[item.href] || "•"}</span>
            <span>{item.label}</span>
          </Link>;
        })}
      </nav>
      <div className="drawer-account">
        <div><b>{userName}</b><small>{roleName}</small></div>
        <LogoutButton label={signOutLabel} />
      </div>
    </aside>
  </>;
}

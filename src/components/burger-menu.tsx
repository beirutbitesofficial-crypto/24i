"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoutButton } from "@/components/logout-button";

type Item = { href: string; label: string };

export function BurgerMenu({ items, userName, roleName, signOutLabel }: { items: Item[]; userName: string; roleName: string; signOutLabel: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return <>
    <button className="burger-button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}>
      <span /><span /><span />
    </button>
    {open && <button className="burger-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <div className={`burger-drawer ${open ? "open" : ""}`}>
      <div className="burger-drawer-head">
        <div className="brand">24i</div>
        <button className="drawer-close" aria-label="Close navigation" onClick={() => setOpen(false)}>×</button>
      </div>
      <nav className="burger-nav">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={() => setOpen(false)}>{item.label}</Link>;
        })}
      </nav>
      <div className="drawer-account">
        <div><b>{userName}</b><small>{roleName}</small></div>
        <LogoutButton label={signOutLabel} />
      </div>
    </div>
  </>;
}

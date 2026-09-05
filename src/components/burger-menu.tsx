"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const items = [
  { href: "/", label: "Dashboard", roles: null },
  { href: "/tasks", label: "Tasks", roles: null },
  { href: "/clients", label: "Clients", roles: ["ADMIN", "MANAGER", "EDITOR", "SOCIAL_MEDIA_MANAGER"] },
  { href: "/content", label: "Content", roles: null },
  { href: "/calendar", label: "Calendar", roles: null },
  { href: "/finance", label: "Finance", roles: ["ADMIN", "MANAGER"] },
];

export function BurgerMenu({ roleKey, userName, roleName }: { roleKey: string; userName: string; roleName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const visible = items.filter(item => !item.roles || item.roles.includes(roleKey));

  return <>
    <button className="burger" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
      <span /><span /><span />
    </button>
    {open && <button className="drawer-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />}
    <aside className={`drawer ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="drawer-head">
        <div className="brand">24i</div>
        <button className="drawer-close" aria-label="Close menu" onClick={() => setOpen(false)}>×</button>
      </div>
      <nav className="drawer-nav">
        {visible.map(item => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link className={active ? "active" : ""} key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</Link>;
        })}
      </nav>
      <div className="drawer-user"><b>{userName}</b><span>{roleName}</span></div>
    </aside>
  </>;
}

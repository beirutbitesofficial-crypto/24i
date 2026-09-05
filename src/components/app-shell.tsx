import Link from "next/link";
import type { User, Role } from "@prisma/client";

type ShellUser = User & { role: Role & { permissions: { permission: string }[] } };
type NavItem = { href: string; label: string; permission?: string };

export function AppShell({ user, title, kicker, children }: { user: ShellUser; title: string; kicker: string; children: React.ReactNode }) {
  const permissions = new Set(user.role.permissions.map((p) => p.permission));
  const can = (permission?: string) => !permission || user.role.key === "ADMIN" || permissions.has(permission);
  const client = user.role.key === "CLIENT";

  const items: NavItem[] = [
    { href: "/", label: "Dashboard", permission: "dashboard.read" },
    { href: "/users", label: "Users", permission: "users.read" },
    { href: "/clients", label: client ? "My company" : "Clients", permission: "clients.read" },
    { href: "/projects", label: "Projects", permission: "projects.read" },
    { href: "/tasks", label: "Tasks", permission: "tasks.read" },
    { href: "/content", label: "Content", permission: "content.read" },
    { href: "/calendar", label: "Calendar", permission: "calendar.read" },
    { href: "/finance", label: client ? "Payments" : "Finance", permission: client ? "finance.client.read" : "finance.read" },
    { href: "/audit", label: "Audit", permission: "audit.read" },
  ].filter((item) => can(item.permission));

  return <main className="shell">
    <aside>
      <div className="brand">24i</div>
      <nav className="desktop-nav">{items.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
      <small>{user.name}<br />{user.role.name}</small>
    </aside>
    <section className="workspace">
      <header><div><span className="eyebrow">{kicker}</span><h1>{title}</h1></div><button className="secondary">EN · AR</button></header>
      {children}
    </section>
    <nav className="mobile-nav">{items.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
  </main>;
}

import Link from "next/link";
import type { User, Role } from "@prisma/client";
import { LanguageToggle } from "@/components/language-toggle";

type ShellUser = User & { role: Role & { permissions: { permission: string }[] } };
type NavItem = { href: string; label: string; permission?: string };

export function AppShell({ user, title, kicker, children }: { user: ShellUser; title: string; kicker: string; children: React.ReactNode }) {
  const permissions = new Set(user.role.permissions.map((p) => p.permission));
  const can = (permission?: string) => !permission || user.role.key === "ADMIN" || permissions.has(permission);
  const client = user.role.key === "CLIENT";
  const ar = user.language === "AR";

  const items: NavItem[] = [
    { href: "/", label: ar ? "لوحة التحكم" : "Dashboard", permission: "dashboard.read" },
    { href: "/notifications", label: ar ? "الإشعارات" : "Notifications", permission: "notifications.read" },
    { href: "/users", label: ar ? "المستخدمون" : "Users", permission: "users.read" },
    { href: "/clients", label: ar ? (client ? "شركتي" : "العملاء") : (client ? "My company" : "Clients"), permission: "clients.read" },
    { href: "/projects", label: ar ? "المشاريع" : "Projects", permission: "projects.read" },
    { href: "/tasks", label: ar ? "المهام" : "Tasks", permission: "tasks.read" },
    { href: "/content", label: ar ? "المحتوى" : "Content", permission: "content.read" },
    { href: "/calendar", label: ar ? "التقويم" : "Calendar", permission: "calendar.read" },
    { href: "/files", label: ar ? "الملفات" : "Files", permission: "files.read" },
    { href: "/finance", label: ar ? (client ? "المدفوعات" : "المالية") : (client ? "Payments" : "Finance"), permission: client ? "finance.client.read" : "finance.read" },
    { href: "/audit", label: ar ? "سجل التدقيق" : "Audit", permission: "audit.read" },
  ].filter((item) => can(item.permission));

  return <main className="shell" dir={ar ? "rtl" : "ltr"}>
    <aside>
      <div className="brand">24i</div>
      <nav className="desktop-nav">{items.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
      <small>{user.name}<br />{user.role.name}</small>
    </aside>
    <section className="workspace">
      <header><div><span className="eyebrow">{kicker}</span><h1>{title}</h1></div><LanguageToggle language={user.language} /></header>
      {children}
    </section>
    <nav className="mobile-nav">{items.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</nav>
  </main>;
}

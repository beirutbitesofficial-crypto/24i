import type { User, Role } from "@prisma/client";
import { LanguageToggle } from "@/components/language-toggle";
import { LogoutButton } from "@/components/logout-button";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { initials } from "@/components/ui";

type ShellUser = User & { role: Role & { permissions: { permission: string }[] } };
type Item = NavItem & { permission?: string; primary?: boolean };

export function AppShell({ user, title, kicker, actions, children }: { user: ShellUser; title: string; kicker: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const permissions = new Set(user.role.permissions.map((p) => p.permission));
  const can = (permission?: string) => !permission || user.role.key === "ADMIN" || permissions.has(permission);
  const client = user.role.key === "CLIENT";
  const ar = user.language === "AR";

  const items: Item[] = ([
    { href: "/", icon: "dashboard", label: ar ? "لوحة التحكم" : "Dashboard", permission: "dashboard.read", primary: true },
    { href: "/tasks", icon: "check", label: ar ? "المهام" : "Tasks", permission: "tasks.read", primary: true },
    { href: "/content", icon: "image", label: ar ? "المحتوى" : "Content", permission: "content.read", primary: true },
    { href: "/calendar", icon: "calendar", label: ar ? "التقويم" : "Calendar", permission: "calendar.read", primary: true },
    { href: "/clients", icon: "briefcase", label: ar ? (client ? "شركتي" : "العملاء") : (client ? "My company" : "Clients"), permission: "clients.read" },
    { href: "/projects", icon: "folder", label: ar ? "المشاريع" : "Projects", permission: "projects.read" },
    { href: "/files", icon: "file", label: ar ? "الملفات" : "Files", permission: "files.read" },
    { href: "/finance", icon: "wallet", label: ar ? (client ? "المدفوعات" : "المالية") : (client ? "Payments" : "Finance"), permission: client ? "finance.client.read" : "finance.read" },
    { href: "/reports", icon: "chart", label: ar ? "التقارير" : "Reports", permission: "finance.reports.read" },
    { href: "/notifications", icon: "bell", label: ar ? "الإشعارات" : "Notifications", permission: "notifications.read", primary: true },
    { href: "/users", icon: "users", label: ar ? "المستخدمون" : "Users", permission: "users.read" },
    { href: "/audit", icon: "shield", label: ar ? "سجل التدقيق" : "Audit log", permission: "audit.read" },
    { href: "/settings", icon: "settings", label: ar ? "الإعدادات" : "Settings", permission: "settings.read" },
  ] as Item[]).filter((item) => can(item.permission));

  const workspace = items.filter((i) => ["/", "/tasks", "/content", "/calendar", "/notifications"].includes(i.href));
  const manage = items.filter((i) => !workspace.includes(i));
  const strip = ({ href, label, icon }: Item): NavItem => ({ href, label, icon });

  return <div className="shell" dir={ar ? "rtl" : "ltr"} lang={ar ? "ar" : "en"}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">24i</span><span className="brand-name">Production<small>Agency OS</small></span></div>
      <div className="nav-group"><span className="nav-label">{ar ? "مساحة العمل" : "Workspace"}</span><NavLinks className="side-nav" items={workspace.map(strip)} /></div>
      {manage.length > 0 && <div className="nav-group"><span className="nav-label">{ar ? "الإدارة" : "Manage"}</span><NavLinks className="side-nav" items={manage.map(strip)} /></div>}
      <div className="account-block">
        <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
        <span className="account-meta"><b>{user.name}</b><small>{user.role.name}</small></span>
        <LogoutButton label={ar ? "تسجيل الخروج" : "Sign out"} />
      </div>
    </aside>
    <div className="main">
      <header className="topbar">
        <div className="topbar-title"><span className="eyebrow">{kicker}</span><h1>{title}</h1></div>
        <div className="topbar-actions">{actions}<LanguageToggle language={user.language} /><span className="avatar mobile-only" aria-hidden="true">{initials(user.name)}</span></div>
      </header>
      <main className="workspace">{children}</main>
    </div>
    <NavLinks className="mobile-nav" items={[...items.filter((i) => i.primary), ...items.filter((i) => !i.primary)].map(strip)} />
  </div>;
}

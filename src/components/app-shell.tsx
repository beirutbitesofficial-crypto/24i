import type { User, Role } from "@prisma/client";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";
import { BurgerMenu } from "@/components/burger-menu";
import { ArabicUi } from "@/components/arabic-ui";
import { RouteMotion } from "@/components/route-motion";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { initials } from "@/components/ui";

type ShellUser = User & { role: Role & { permissions: { permission: string }[] } };
type Item = NavItem & { permission?: string; hideForClient?: boolean; roles?: string[] };

const arTitles: Record<string, string> = {
  Dashboard: "لوحة التحكم",
  Notifications: "الإشعارات",
  Users: "المستخدمون",
  Clients: "العملاء",
  Projects: "المشاريع",
  Tasks: "المهام",
  Content: "المحتوى",
  Scripts: "السكربتات",
  "Shooting days": "أيام التصوير",
  Calendar: "التقويم",
  "Content calendar": "تقويم المحتوى",
  Files: "الملفات",
  Finance: "المالية",
  Payments: "المدفوعات",
  Reports: "التقارير",
  Audit: "سجل التدقيق",
  "Audit log": "سجل التدقيق",
  Settings: "الإعدادات",
  "My company": "شركتي",
  "User management": "إدارة المستخدمين",
};

const arKickers: Record<string, string> = {
  TODAY: "اليوم",
  PRODUCTION: "الإنتاج",
  APPROVALS: "الموافقات",
  CONFIGURATION: "الإعدادات",
  ACCESS: "الصلاحيات",
  "ACCESS CONTROL": "إدارة الصلاحيات",
  WORKLOAD: "المهام",
  CLIENTS: "العملاء",
  RELATIONSHIPS: "العملاء",
  PROJECTS: "المشاريع",
  "PRODUCTION PIPELINE": "المشاريع",
  FINANCE: "المالية",
  "THIS MONTH": "هذا الشهر",
  "MY ACCOUNT": "حسابي",
  REPORTING: "التقارير",
  FILES: "الملفات",
  "ASSET LIBRARY": "مكتبة الملفات",
  CALENDAR: "التقويم",
  SCHEDULE: "الجدول",
  INBOX: "الوارد",
  ACCOUNTABILITY: "المساءلة",
};

const arRoles: Record<string, string> = {
  ADMIN: "مدير النظام",
  MANAGER: "مدير",
  EDITOR: "مونتير",
  SOCIAL_MEDIA_MANAGER: "مدير سوشيال ميديا",
  CLIENT: "عميل",
};

const WORKSPACE = ["/", "/tasks", "/content", "/scripts", "/shooting", "/calendar", "/notifications"];

export function AppShell({ user, title, kicker, actions, children }: { user: ShellUser; title: string; kicker: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const permissions = new Set(user.role.permissions.map((p) => p.permission));
  const can = (permission?: string) => !permission || user.role.key === "ADMIN" || permissions.has(permission);
  const client = user.role.key === "CLIENT";
  const ar = user.language === "AR";

  const items: Item[] = ([
    { href: "/", icon: "dashboard", label: ar ? "الرئيسية" : "Home", permission: "dashboard.read" },
    { href: "/tasks", icon: "check", label: ar ? "المهام" : "Tasks", permission: "tasks.read" },
    { href: "/content", icon: "image", label: ar ? "المحتوى" : "Content", permission: "content.read" },
    { href: "/scripts", icon: "script", label: ar ? "السكربتات" : "Scripts", roles: ["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER", "CLIENT"] },
    { href: "/shooting", icon: "camera", label: ar ? "أيام التصوير" : "Shooting days", roles: ["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER"] },
    { href: "/calendar", icon: "calendar", label: ar ? "التقويم" : "Calendar", permission: "calendar.read" },
    { href: "/notifications", icon: "bell", label: ar ? "الإشعارات" : "Notifications", permission: "notifications.read" },
    { href: "/clients", icon: "briefcase", label: ar ? (client ? "شركتي" : "العملاء") : (client ? "My company" : "Clients"), permission: "clients.read" },
    { href: "/projects", icon: "folder", label: ar ? "المشاريع" : "Projects", permission: "projects.read" },
    { href: "/files", icon: "file", label: ar ? "الملفات" : "Files", permission: "files.read", hideForClient: true },
    { href: "/finance", icon: "wallet", label: ar ? (client ? "المدفوعات" : "المالية") : (client ? "Payments" : "Finance"), permission: client ? "finance.client.read" : "finance.read" },
    { href: "/reports", icon: "chart", label: ar ? "التقارير" : "Reports", permission: "finance.reports.read" },
    { href: "/users", icon: "users", label: ar ? "المستخدمون" : "Users", permission: "users.read" },
    { href: "/audit", icon: "shield", label: ar ? "سجل التدقيق" : "Audit log", permission: "audit.read" },
    { href: "/settings", icon: "settings", label: ar ? "الإعدادات" : "Settings", permission: "settings.read" },
  ] as Item[]).filter((item) => can(item.permission) && !(client && item.hideForClient) && (!item.roles || item.roles.includes(user.role.key)));

  const strip = ({ href, label, icon }: Item): NavItem => ({ href, label, icon });
  const workspace = items.filter((i) => WORKSPACE.includes(i.href)).map(strip);
  const manage = items.filter((i) => !WORKSPACE.includes(i.href)).map(strip);

  const displayTitle = ar ? (arTitles[title] || title) : title;
  const displayKicker = ar ? (arKickers[kicker.toUpperCase()] || kicker) : kicker;
  const roleName = ar ? (arRoles[user.role.key] || user.role.name) : user.role.name;
  const signOut = ar ? "تسجيل الخروج" : "Sign out";

  return <div className="shell" dir={ar ? "rtl" : "ltr"} lang={ar ? "ar" : "en"} data-language={ar ? "ar" : "en"}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">24i</span><span className="brand-name">Production<small>Agency OS</small></span></div>
      <div className="nav-group"><span className="nav-heading">{ar ? "مساحة العمل" : "Workspace"}</span><NavLinks className="side-nav" items={workspace} /></div>
      {manage.length > 0 && <div className="nav-group"><span className="nav-heading">{ar ? "الإدارة" : "Manage"}</span><NavLinks className="side-nav" items={manage} /></div>}
      <div className="account-block">
        <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
        <span className="account-meta"><b>{user.name}</b><small>{roleName}</small></span>
        <LogoutButton label={signOut} variant="icon" />
      </div>
    </aside>
    <div className="main">
      <header className="topbar">
        <div className="topbar-lead">
          <span className="mobile-only"><BurgerMenu items={items.map(({ href, label }) => ({ href, label }))} userName={user.name} roleName={roleName} signOutLabel={signOut} ar={ar} /></span>
          <div className="topbar-title"><span className="eyebrow">{displayKicker}</span><h1>{displayTitle}</h1></div>
        </div>
        <div className="topbar-actions">{actions}<ThemeToggle ar={ar} /><LanguageToggle language={user.language} /></div>
      </header>
      <main className="workspace"><RouteMotion>{children}</RouteMotion></main>
    </div>
    {ar && <ArabicUi />}
  </div>;
}

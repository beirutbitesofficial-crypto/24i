import type { User, Role } from "@prisma/client";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { BurgerMenu } from "@/components/burger-menu";

type ShellUser = User & { role: Role & { permissions: { permission: string }[] } };
type NavItem = { href: string; label: string; permission?: string };

const arTitles: Record<string, string> = {
  Dashboard: "لوحة التحكم",
  Notifications: "الإشعارات",
  Users: "المستخدمون",
  Clients: "العملاء",
  Projects: "المشاريع",
  Tasks: "المهام",
  Content: "المحتوى",
  Calendar: "التقويم",
  Files: "الملفات",
  Finance: "المالية",
  Reports: "التقارير",
  Audit: "سجل التدقيق",
  Settings: "الإعدادات",
  "User management": "إدارة المستخدمين",
};

const arKickers: Record<string, string> = {
  TODAY: "اليوم",
  PRODUCTION: "الإنتاج",
  CONFIGURATION: "الإعدادات",
  ACCESS: "الصلاحيات",
  "ACCESS CONTROL": "إدارة الصلاحيات",
};

const arRoles: Record<string, string> = {
  ADMIN: "مدير النظام",
  MANAGER: "مدير",
  EDITOR: "مونتير",
  SOCIAL_MEDIA_MANAGER: "مدير سوشيال ميديا",
  CLIENT: "عميل",
};

export function AppShell({ user, title, kicker, children }: { user: ShellUser; title: string; kicker: string; children: React.ReactNode }) {
  const permissions = new Set(user.role.permissions.map((p) => p.permission));
  const can = (permission?: string) => !permission || user.role.key === "ADMIN" || permissions.has(permission);
  const client = user.role.key === "CLIENT";
  const ar = user.language === "AR";

  const items: NavItem[] = [
    { href: "/", label: ar ? "الرئيسية" : "Home", permission: "dashboard.read" },
    { href: "/notifications", label: ar ? "الإشعارات" : "Notifications", permission: "notifications.read" },
    { href: "/users", label: ar ? "المستخدمون" : "Users", permission: "users.read" },
    { href: "/clients", label: ar ? (client ? "شركتي" : "العملاء") : (client ? "My company" : "Clients"), permission: "clients.read" },
    { href: "/projects", label: ar ? "المشاريع" : "Projects", permission: "projects.read" },
    { href: "/tasks", label: ar ? "المهام" : "Tasks", permission: "tasks.read" },
    { href: "/content", label: ar ? "المحتوى" : "Content", permission: "content.read" },
    { href: "/calendar", label: ar ? "التقويم" : "Calendar", permission: "calendar.read" },
    { href: "/files", label: ar ? "الملفات" : "Files", permission: "files.read" },
    { href: "/finance", label: ar ? (client ? "المدفوعات" : "المالية") : (client ? "Payments" : "Finance"), permission: client ? "finance.client.read" : "finance.read" },
    { href: "/reports", label: ar ? "التقارير" : "Reports", permission: "finance.reports.read" },
    { href: "/audit", label: ar ? "سجل التدقيق" : "Audit", permission: "audit.read" },
    { href: "/settings", label: ar ? "الإعدادات" : "Settings", permission: "settings.read" },
  ].filter((item) => can(item.permission));

  const displayTitle = ar ? (arTitles[title] || title) : title;
  const displayKicker = ar ? (arKickers[kicker] || kicker) : kicker;
  const roleName = ar ? (arRoles[user.role.key] || user.role.name) : user.role.name;

  return <main className="shell menu-shell" dir={ar ? "rtl" : "ltr"} data-language={ar ? "ar" : "en"}>
    <section className="workspace">
      <header className="app-header">
        <div className="header-main">
          <BurgerMenu items={items.map(({ href, label }) => ({ href, label }))} userName={user.name} roleName={roleName} signOutLabel={ar ? "تسجيل الخروج" : "Sign out"} ar={ar} />
          <div className="page-heading">
            <span className="eyebrow">{displayKicker}</span>
            <h1>{displayTitle}</h1>
          </div>
        </div>
        <div className="preference-controls">
          <ThemeToggle ar={ar} />
          <LanguageToggle language={user.language} />
        </div>
      </header>
      {children}
    </section>
  </main>;
}

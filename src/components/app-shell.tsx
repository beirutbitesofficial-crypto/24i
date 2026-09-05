import type { Role, User } from "@prisma/client";
import { BurgerMenu } from "@/components/burger-menu";

export function AppShell({ user, title, kicker, children }: { user: User & { role: Role }; title: string; kicker: string; children: React.ReactNode }) {
  return <main className="app-shell">
    <section className="workspace">
      <header className="app-header">
        <div className="header-left">
          <BurgerMenu roleKey={user.role.key} userName={user.name} roleName={user.role.name} />
          <div className="topbar-brand">24i</div>
          <div className="header-copy">
            <span className="eyebrow">{kicker}</span>
            <h1>{title}</h1>
          </div>
        </div>
        <button className="secondary">EN · AR</button>
      </header>
      {children}
    </section>
  </main>;
}

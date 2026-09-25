import { Icon } from "@/components/ui";

// Split-screen layout shared by the sign-in and client sign-up pages.
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <main className="login">
    <section className="login-hero">
      <div className="brand"><span className="brand-mark">24i</span><span className="brand-name">Production<small>Agency OS</small></span></div>
      <div>
        <h1>Agency work, in one place.</h1>
        <p>Plan content, collect client approvals, schedule publishing and keep finances exact — from one workspace.</p>
        <ul className="login-points">
          <li><Icon name="check" />Visual and caption approvals in one review</li>
          <li><Icon name="calendar" />Content calendar and auto-publishing</li>
          <li><Icon name="wallet" />Invoices, payments and reports to the cent</li>
        </ul>
      </div>
      <footer>© {new Date().getFullYear()} 24i Production</footer>
    </section>
    <section className="login-panel">
      <div className="login-card">
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
        {children}
      </div>
    </section>
  </main>;
}

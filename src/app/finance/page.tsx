import { redirect } from "next/navigation";
import { requirePageUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { AppShell } from "@/components/app-shell";
import { FinanceManager } from "@/components/finance-manager";
import { Badge, Card, Empty, Icon, humanize, usd } from "@/components/ui";

type InvoiceRow = { id: string; number: string; total: ReturnType<typeof money>; status: string; dueDate: Date; client: { brandName: string }; payments: { amount: ReturnType<typeof money> }[] };

const paidOf = (i: InvoiceRow) => i.payments.reduce((s, p) => s.plus(p.amount), money(0));

function InvoiceTable({ invoices }: { invoices: InvoiceRow[] }) {
  if (!invoices.length) return <Empty title="No invoices yet" />;
  const now = new Date();
  return <table><thead><tr><th>Invoice</th><th>Client</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Remaining</th><th>Status</th><th>Due</th></tr></thead><tbody>
    {invoices.map((i) => {
      const paid = paidOf(i);
      const overdue = i.status !== "PAID" && i.dueDate < now;
      return <tr key={i.id}>
        <td><b>{i.number}</b></td>
        <td>{i.client.brandName}</td>
        <td className="num">{usd(i.total)}</td>
        <td className="num">{usd(paid)}</td>
        <td className="num"><b>{usd(i.total.minus(paid))}</b></td>
        <td>{overdue ? <Badge value="OVERDUE" /> : <Badge value={i.status} />}</td>
        <td>{i.dueDate.toLocaleDateString(undefined, { dateStyle: "medium" })}</td>
      </tr>;
    })}
  </tbody></table>;
}

export default async function Finance() {
  const user = await requirePageUser();

  if (user.role.key === "CLIENT") {
    if (!hasPermission(user, "finance.client.read")) redirect("/");
    const ids = assignedClientIds(user) || [];
    const [invoices, packages] = await Promise.all([
      db.invoice.findMany({ where: { clientId: { in: ids }, voidedAt: null }, include: { client: true, payments: { where: { reversedAt: null } } }, orderBy: { issuedAt: "desc" } }),
      db.clientPackage.findMany({ where: { clientId: { in: ids } }, include: { package: true, client: true }, orderBy: { startsAt: "desc" } }),
    ]);
    const total = invoices.reduce((s, x) => s.plus(x.total), money(0));
    const paid = invoices.reduce((s, x) => s.plus(paidOf(x)), money(0));
    const currentPackage = packages.find((p) => !p.endsAt || p.endsAt >= new Date()) || packages[0];

    return <AppShell user={user} title="Payments" kicker="My account">
      <div className="metrics">
        <article><span><Icon name="briefcase" size={16} />Current package</span><b>{currentPackage ? usd(currentPackage.price) : "—"}</b>{currentPackage && <small>{currentPackage.package.name} · {humanize(currentPackage.package.interval)}</small>}</article>
        <article><span><Icon name="check" size={16} />Paid</span><b>{usd(paid)}</b></article>
        <article><span><Icon name="clock" size={16} />Remaining</span><b>{usd(total.minus(paid))}</b></article>
      </div>
      <section className="panel tablewrap">
        <div className="section-head"><div><span className="eyebrow">Billing</span><h2>Invoices</h2></div></div>
        <InvoiceTable invoices={invoices} />
      </section>
    </AppShell>;
  }

  if (!hasPermission(user, "finance.read")) redirect("/");
  const canPackages = hasPermission(user, "packages.write");
  const canInvoice = hasPermission(user, "finance.invoices.write");
  const canPayment = hasPermission(user, "finance.payments.write");
  const canExpense = hasPermission(user, "finance.expenses.write");
  const canSalary = hasPermission(user, "finance.salaries.write");
  const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [tx, clients, invoices, categories, employees, salaryProfiles, expenses, salaryPayments, packages] = await Promise.all([
    db.financialTransaction.findMany({ where: { createdAt: { gte: start } } }),
    db.client.findMany({ select: { id: true, brandName: true }, orderBy: { brandName: "asc" } }),
    db.invoice.findMany({ where: { voidedAt: null }, include: { client: true, payments: { where: { reversedAt: null } } }, orderBy: { issuedAt: "desc" }, take: 100 }),
    db.expenseCategory.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { status: "ACTIVE", role: { key: { not: "CLIENT" } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.salaryProfile.findMany({ where: { active: true }, orderBy: { employeeId: "asc" } }),
    db.expense.findMany({ where: { reversedAt: null }, include: { category: true, client: true }, orderBy: { date: "desc" }, take: 30 }),
    db.salaryPayment.findMany({ where: { reversedAt: null }, include: { profile: true }, orderBy: { paymentDate: "desc" }, take: 30 }),
    db.package.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const employeeNames = new Map(employees.map((e) => [e.id, e.name]));
  const sum = (type: string) => tx.filter((x) => x.type === type).reduce((s, x) => s.plus(x.amount), money(0));
  const revenue = sum("PAYMENT"), expensesTotal = sum("EXPENSE").abs(), salaries = sum("SALARY").abs();
  const outstanding = invoices.reduce((s, i) => s.plus(i.total.minus(paidOf(i))), money(0));
  const invoiceOptions = invoices
    .map((i) => ({ id: i.id, number: i.number, client: i.client.brandName, remaining: i.total.minus(paidOf(i)).toFixed(2) }))
    .filter((i) => money(i.remaining).gt(0));

  return <AppShell user={user} title="Finance" kicker="This month">
    <div className="metrics">
      <article><span><Icon name="wallet" size={16} />Collected</span><b>{usd(revenue)}</b></article>
      <article><span><Icon name="clock" size={16} />Outstanding</span><b>{usd(outstanding)}</b><small>Across all open invoices</small></article>
      <article><span><Icon name="file" size={16} />Expenses & salaries</span><b>{usd(expensesTotal.plus(salaries))}</b></article>
      <article><span><Icon name="chart" size={16} />Net profit</span><b>{usd(revenue.minus(expensesTotal).minus(salaries))}</b></article>
    </div>
    <div className="management-stack">
      <FinanceManager clients={clients} invoices={invoiceOptions} categories={categories.map((c) => ({ id: c.id, name: c.name }))} employees={employees} salaryProfiles={salaryProfiles.map((s) => ({ id: s.id, employee: employeeNames.get(s.employeeId) || s.employeeId, baseSalary: s.baseSalary.toFixed(2) }))} packages={packages.map((p) => ({ id: p.id, name: p.name, price: p.price.toFixed(2), interval: p.interval }))} canPackages={canPackages} canInvoice={canInvoice} canPayment={canPayment} canExpense={canExpense} canSalary={canSalary} />

      <section className="panel tablewrap">
        <div className="section-head"><div><span className="eyebrow">Invoices</span><h2>Receivables</h2></div></div>
        <InvoiceTable invoices={invoices} />
      </section>

      <div className="grid-2">
        <section className="panel tablewrap">
          <div className="section-head"><div><span className="eyebrow">Recent costs</span><h2>Expenses</h2></div></div>
          {expenses.length
            ? <table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th className="num">Amount</th></tr></thead><tbody>{expenses.map((e) => <tr key={e.id}><td>{e.date.toLocaleDateString(undefined, { dateStyle: "medium" })}</td><td><b>{e.description}</b><small>{e.client?.brandName || "Company"}</small></td><td>{e.category.name}</td><td className="num">{usd(e.amount)}</td></tr>)}</tbody></table>
            : <Empty title="No expenses recorded" />}
        </section>
        <section className="panel tablewrap">
          <div className="section-head"><div><span className="eyebrow">Payroll</span><h2>Recent salary payments</h2></div></div>
          {salaryPayments.length
            ? <table><thead><tr><th>Date</th><th>Employee</th><th className="num">Base</th><th className="num">Adjustments</th><th className="num">Final</th></tr></thead><tbody>{salaryPayments.map((s) => <tr key={s.id}><td>{s.paymentDate.toLocaleDateString(undefined, { dateStyle: "medium" })}</td><td>{employeeNames.get(s.profile.employeeId) || "Former employee"}</td><td className="num">{usd(s.base)}</td><td className="num">+{usd(s.bonus)}<small>−{usd(s.deduction.plus(s.advance))}</small></td><td className="num"><b>{usd(s.finalAmount)}</b></td></tr>)}</tbody></table>
            : <Empty title="No salary payments yet" />}
        </section>
      </div>
      {packages.length > 0 && <Card eyebrow="Catalogue" title="Active packages">
        <div className="list">{packages.map((p) => <div className="row" key={p.id}><span className="row-main"><b>{p.name}</b><span>{humanize(p.interval)}</span></span><b>{usd(p.price)}</b></div>)}</div>
      </Card>}
    </div>
  </AppShell>;
}

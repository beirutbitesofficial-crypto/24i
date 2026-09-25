import { redirect } from "next/navigation";
import { requirePageUser, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { AppShell } from "@/components/app-shell";
import { Card, Empty, Icon, humanize, usd } from "@/components/ui";

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  if (!rows.length) return <Empty title="No data yet" />;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return <div className="bars">{rows.map((r) => <div className="bar" key={r.label}>
    <span>{r.label}</span>
    <span className="bar-track"><span className="bar-fill" style={{ display: "block", width: `${(r.value / max) * 100}%` }} /></span>
    <b>{r.value}</b>
  </div>)}</div>;
}

export default async function ReportsPage() {
  const user = await requirePageUser();
  if (!hasPermission(user, "finance.reports.read")) redirect("/");
  const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [clients, invoices, payments, expenses, salaries, tasks, content] = await Promise.all([
    db.client.count({ where: { status: "ACTIVE" } }),
    db.invoice.aggregate({ where: { issuedAt: { gte: start }, voidedAt: null }, _sum: { total: true } }),
    // Cash actually received this month, whichever month the invoice was issued in.
    db.payment.aggregate({ where: { paidAt: { gte: start }, reversedAt: null, invoice: { voidedAt: null } }, _sum: { amount: true } }),
    db.expense.findMany({ where: { date: { gte: start }, reversedAt: null }, include: { category: true } }),
    db.salaryPayment.aggregate({ where: { paymentDate: { gte: start }, reversedAt: null }, _sum: { finalAmount: true } }),
    db.task.groupBy({ by: ["status"], _count: { _all: true } }),
    db.contentItem.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const invoiced = invoices._sum.total ?? money(0);
  const collected = payments._sum.amount ?? money(0);
  const salaryTotal = salaries._sum.finalAmount ?? money(0);
  const expenseTotal = expenses.reduce((s, x) => s.plus(x.amount), money(0));
  const byCategory = new Map<string, ReturnType<typeof money>>();
  for (const e of expenses) byCategory.set(e.category.name, (byCategory.get(e.category.name) || money(0)).plus(e.amount));
  const month = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return <AppShell user={user} title="Reports" kicker={month}>
    <div className="metrics">
      <article><span><Icon name="briefcase" size={16} />Active clients</span><b>{clients}</b></article>
      <article><span><Icon name="file" size={16} />Invoiced</span><b>{usd(invoiced)}</b></article>
      <article><span><Icon name="wallet" size={16} />Collected</span><b>{usd(collected)}</b></article>
      <article><span><Icon name="chart" size={16} />Net cash</span><b>{usd(collected.minus(expenseTotal).minus(salaryTotal))}</b><small>After {usd(expenseTotal)} expenses and {usd(salaryTotal)} salaries</small></article>
    </div>
    <div className="grid-2">
      <Card eyebrow="Workload" title="Tasks by status"><Bars rows={tasks.map((x) => ({ label: humanize(x.status), value: x._count._all }))} /></Card>
      <Card eyebrow="Content" title="Production pipeline"><Bars rows={content.map((x) => ({ label: humanize(x.status), value: x._count._all }))} /></Card>
    </div>
    <div className="management-stack">
      <section className="panel tablewrap">
        <div className="section-head"><div><span className="eyebrow">Expense breakdown</span><h2>By category</h2></div></div>
        {byCategory.size
          ? <table><thead><tr><th>Category</th><th className="num">Amount</th><th className="num">Share</th></tr></thead><tbody>{[...byCategory.entries()].sort((a, b) => b[1].comparedTo(a[1])).map(([name, total]) => <tr key={name}><td>{name}</td><td className="num">{usd(total)}</td><td className="num">{expenseTotal.gt(0) ? `${total.div(expenseTotal).times(100).toFixed(0)}%` : "—"}</td></tr>)}</tbody></table>
          : <Empty title="No expenses this month" />}
      </section>
    </div>
  </AppShell>;
}

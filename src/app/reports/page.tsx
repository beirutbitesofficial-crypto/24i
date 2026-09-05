import { redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { AppShell } from "@/components/app-shell";

export default async function ReportsPage() {
  const user = await requireUser();
  if (!hasPermission(user, "finance.reports.read")) redirect("/");
  const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [clients, invoices, expenses, salaries, tasks, content] = await Promise.all([
    db.client.count({ where: { status: "ACTIVE" } }),
    db.invoice.findMany({ where: { issuedAt: { gte: start }, voidedAt: null }, include: { payments: { where: { reversedAt: null } } } }),
    db.expense.findMany({ where: { date: { gte: start }, reversedAt: null }, include: { category: true } }),
    db.salaryPayment.findMany({ where: { paymentDate: { gte: start }, reversedAt: null } }),
    db.task.groupBy({ by: ["status"], _count: { _all: true } }),
    db.contentItem.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const invoiced = invoices.reduce((s, x) => s.plus(x.total), money(0));
  const collected = invoices.reduce((s, x) => s.plus(x.payments.reduce((p, y) => p.plus(y.amount), money(0))), money(0));
  const expenseTotal = expenses.reduce((s, x) => s.plus(x.amount), money(0));
  const salaryTotal = salaries.reduce((s, x) => s.plus(x.finalAmount), money(0));
  const expenseByCategory = new Map<string, ReturnType<typeof money>>();
  for (const expense of expenses) expenseByCategory.set(expense.category.name, (expenseByCategory.get(expense.category.name) || money(0)).plus(expense.amount));

  return <AppShell user={user} title="Reports" kicker="THIS MONTH">
    <div className="management-stack">
      <div className="metrics"><article><span>Active clients</span><b>{clients}</b></article><article><span>Invoiced / collected</span><b className="metric-text">${invoiced.toFixed(2)} / ${collected.toFixed(2)}</b></article><article><span>Net cash</span><b className="metric-text">${collected.minus(expenseTotal).minus(salaryTotal).toFixed(2)}</b></article></div>
      <section className="panel tablewrap"><span className="eyebrow">WORKLOAD</span><h2>Task status</h2><table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>{tasks.map(x=><tr key={x.status}><td>{x.status.replaceAll("_"," ")}</td><td>{x._count._all}</td></tr>)}</tbody></table></section>
      <section className="panel tablewrap"><span className="eyebrow">CONTENT</span><h2>Production status</h2><table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>{content.map(x=><tr key={x.status}><td>{x.status.replaceAll("_"," ")}</td><td>{x._count._all}</td></tr>)}</tbody></table></section>
      <section className="panel tablewrap"><span className="eyebrow">EXPENSE BREAKDOWN</span><h2>By category</h2><table><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>{[...expenseByCategory.entries()].map(([name,total])=><tr key={name}><td>{name}</td><td>${total.toFixed(2)}</td></tr>)}</tbody></table>{!expenseByCategory.size&&<p>No expenses this month.</p>}</section>
    </div>
  </AppShell>;
}

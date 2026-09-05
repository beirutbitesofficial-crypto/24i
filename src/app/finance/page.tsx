import { requireUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { AppShell } from "@/components/app-shell";
import { redirect } from "next/navigation";

export default async function Finance() {
  const user = await requireUser();

  if (user.role.key === "CLIENT") {
    if (!hasPermission(user, "finance.client.read")) redirect("/");
    const ids = assignedClientIds(user) || [];
    const invoices = await db.invoice.findMany({
      where: { clientId: { in: ids }, voidedAt: null },
      include: { client: true, payments: { where: { reversedAt: null } } },
      orderBy: { issuedAt: "desc" },
    });
    const total = invoices.reduce((s, x) => s.plus(x.total), money(0));
    const paid = invoices.reduce((s, x) => s.plus(x.payments.reduce((p, y) => p.plus(y.amount), money(0))), money(0));
    const remaining = total.minus(paid);

    return <AppShell user={user} title="Payments" kicker="MY ACCOUNT">
      <div className="metrics"><article><span>Package / invoiced</span><b>${total.toFixed(2)}</b></article><article><span>Paid</span><b>${paid.toFixed(2)}</b></article><article><span>Remaining</span><b>${remaining.toFixed(2)}</b></article></div>
      <div className="panel tablewrap"><table><thead><tr><th>Invoice</th><th>Client</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Status</th><th>Due</th></tr></thead><tbody>{invoices.map((x) => { const invoicePaid = x.payments.reduce((s, p) => s.plus(p.amount), money(0)); const due = x.total.minus(invoicePaid); return <tr key={x.id}><td><b>{x.number}</b></td><td>{x.client.brandName}</td><td>${x.total.toFixed(2)}</td><td>${invoicePaid.toFixed(2)}</td><td>${due.toFixed(2)}</td><td>{x.status.replaceAll("_", " ")}</td><td>{x.dueDate.toLocaleDateString()}</td></tr>; })}</tbody></table>{!invoices.length && <p>No invoices yet.</p>}</div>
    </AppShell>;
  }

  if (!hasPermission(user, "finance.read")) redirect("/");
  const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const tx = await db.financialTransaction.findMany({ where: { createdAt: { gte: start } } });
  const sum = (type: string) => tx.filter((x) => x.type === type).reduce((s, x) => s.plus(x.amount), money(0));
  const revenue = sum("PAYMENT"), expenses = sum("EXPENSE").abs(), salaries = sum("SALARY").abs();

  return <AppShell user={user} title="Finance overview" kicker="THIS MONTH">
    <div className="metrics"><article><span>Collected revenue</span><b>${revenue.toFixed(2)}</b></article><article><span>Expenses & salaries</span><b>${expenses.plus(salaries).toFixed(2)}</b></article><article><span>Net profit</span><b>${revenue.minus(expenses).minus(salaries).toFixed(2)}</b></article></div>
  </AppShell>;
}

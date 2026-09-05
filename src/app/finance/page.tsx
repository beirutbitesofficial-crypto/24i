import { requireUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { AppShell } from "@/components/app-shell";
import { FinanceManager } from "@/components/finance-manager";
import { redirect } from "next/navigation";

export default async function Finance() {
  const user = await requireUser();

  if (user.role.key === "CLIENT") {
    if (!hasPermission(user, "finance.client.read")) redirect("/");
    const ids = assignedClientIds(user) || [];
    const invoices = await db.invoice.findMany({ where: { clientId: { in: ids }, voidedAt: null }, include: { client: true, payments: { where: { reversedAt: null } } }, orderBy: { issuedAt: "desc" } });
    const total = invoices.reduce((s, x) => s.plus(x.total), money(0));
    const paid = invoices.reduce((s, x) => s.plus(x.payments.reduce((p, y) => p.plus(y.amount), money(0))), money(0));
    const remaining = total.minus(paid);
    return <AppShell user={user} title="Payments" kicker="MY ACCOUNT"><div className="metrics"><article><span>Package / invoiced</span><b>${total.toFixed(2)}</b></article><article><span>Paid</span><b>${paid.toFixed(2)}</b></article><article><span>Remaining</span><b>${remaining.toFixed(2)}</b></article></div><div className="panel tablewrap"><table><thead><tr><th>Invoice</th><th>Client</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Status</th><th>Due</th></tr></thead><tbody>{invoices.map((x) => { const invoicePaid=x.payments.reduce((s,p)=>s.plus(p.amount),money(0)); const due=x.total.minus(invoicePaid); return <tr key={x.id}><td><b>{x.number}</b></td><td>{x.client.brandName}</td><td>${x.total.toFixed(2)}</td><td>${invoicePaid.toFixed(2)}</td><td>${due.toFixed(2)}</td><td>{x.status.replaceAll("_"," ")}</td><td>{x.dueDate.toLocaleDateString()}</td></tr>; })}</tbody></table>{!invoices.length&&<p>No invoices yet.</p>}</div></AppShell>;
  }

  if (!hasPermission(user, "finance.read")) redirect("/");
  const canInvoice=hasPermission(user,"finance.invoices.write"),canPayment=hasPermission(user,"finance.payments.write"),canExpense=hasPermission(user,"finance.expenses.write"),canSalary=hasPermission(user,"finance.salaries.write");
  const start=new Date(new Date().getFullYear(),new Date().getMonth(),1);
  const [tx,clients,invoices,categories,employees,salaryProfiles,expenses,salaryPayments]=await Promise.all([
    db.financialTransaction.findMany({where:{createdAt:{gte:start}}}),
    db.client.findMany({select:{id:true,brandName:true},orderBy:{brandName:"asc"}}),
    db.invoice.findMany({where:{voidedAt:null},include:{client:true,payments:{where:{reversedAt:null}}},orderBy:{issuedAt:"desc"},take:100}),
    db.expenseCategory.findMany({where:{active:true},orderBy:{name:"asc"}}),
    db.user.findMany({where:{status:"ACTIVE",role:{key:{not:"CLIENT"}}},select:{id:true,name:true},orderBy:{name:"asc"}}),
    db.salaryProfile.findMany({where:{active:true},orderBy:{employeeId:"asc"}}),
    db.expense.findMany({where:{reversedAt:null},include:{category:true,client:true},orderBy:{date:"desc"},take:30}),
    db.salaryPayment.findMany({where:{reversedAt:null},include:{profile:true},orderBy:{paymentDate:"desc"},take:30}),
  ]);
  const employeeNames=new Map(employees.map(e=>[e.id,e.name]));
  const sum=(type:string)=>tx.filter(x=>x.type===type).reduce((s,x)=>s.plus(x.amount),money(0));
  const revenue=sum("PAYMENT"),expensesTotal=sum("EXPENSE").abs(),salaries=sum("SALARY").abs();
  const invoiceOptions=invoices.map(i=>{const paid=i.payments.reduce((s,p)=>s.plus(p.amount),money(0));return{id:i.id,number:i.number,client:i.client.brandName,remaining:i.total.minus(paid).toFixed(2)}}).filter(i=>money(i.remaining).gt(0));

  return <AppShell user={user} title="Finance overview" kicker="THIS MONTH"><div className="metrics"><article><span>Collected revenue</span><b>${revenue.toFixed(2)}</b></article><article><span>Expenses & salaries</span><b>${expensesTotal.plus(salaries).toFixed(2)}</b></article><article><span>Net profit</span><b>${revenue.minus(expensesTotal).minus(salaries).toFixed(2)}</b></article></div><FinanceManager clients={clients} invoices={invoiceOptions} categories={categories.map(c=>({id:c.id,name:c.name}))} employees={employees} salaryProfiles={salaryProfiles.map(s=>({id:s.id,employee:employeeNames.get(s.employeeId)||s.employeeId,baseSalary:s.baseSalary.toFixed(2)}))} canInvoice={canInvoice} canPayment={canPayment} canExpense={canExpense} canSalary={canSalary}/><div className="management-stack"><section className="panel tablewrap"><span className="eyebrow">INVOICES</span><h2>Receivables</h2><table><thead><tr><th>Invoice</th><th>Client</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Status</th><th>Due</th></tr></thead><tbody>{invoices.map(i=>{const paid=i.payments.reduce((s,p)=>s.plus(p.amount),money(0));return<tr key={i.id}><td>{i.number}</td><td>{i.client.brandName}</td><td>${i.total.toFixed(2)}</td><td>${paid.toFixed(2)}</td><td>${i.total.minus(paid).toFixed(2)}</td><td>{i.status}</td><td>{i.dueDate.toLocaleDateString()}</td></tr>})}</tbody></table></section><section className="panel tablewrap"><span className="eyebrow">RECENT COSTS</span><h2>Expenses</h2><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Client</th><th>Amount</th></tr></thead><tbody>{expenses.map(e=><tr key={e.id}><td>{e.date.toLocaleDateString()}</td><td>{e.description}</td><td>{e.category.name}</td><td>{e.client?.brandName||"Company"}</td><td>${e.amount.toFixed(2)}</td></tr>)}</tbody></table></section><section className="panel tablewrap"><span className="eyebrow">PAYROLL</span><h2>Recent salary payments</h2><table><thead><tr><th>Date</th><th>Employee</th><th>Base</th><th>Bonus</th><th>Deductions + advance</th><th>Final</th></tr></thead><tbody>{salaryPayments.map(s=><tr key={s.id}><td>{s.paymentDate.toLocaleDateString()}</td><td>{employeeNames.get(s.profile.employeeId)||s.profile.employeeId}</td><td>${s.base.toFixed(2)}</td><td>${s.bonus.toFixed(2)}</td><td>${s.deduction.plus(s.advance).toFixed(2)}</td><td>${s.finalAmount.toFixed(2)}</td></tr>)}</tbody></table></section></div></AppShell>;
}

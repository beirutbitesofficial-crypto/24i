"use client";

import { FormEvent, useState } from "react";

type ClientOption = { id: string; brandName: string };
type InvoiceOption = { id: string; number: string; client: string; remaining: string };
type CategoryOption = { id: string; name: string };
type EmployeeOption = { id: string; name: string };
type SalaryOption = { id: string; employee: string; baseSalary: string };

type Props = {
  clients: ClientOption[];
  invoices: InvoiceOption[];
  categories: CategoryOption[];
  employees: EmployeeOption[];
  salaryProfiles: SalaryOption[];
  canInvoice: boolean;
  canPayment: boolean;
  canExpense: boolean;
  canSalary: boolean;
};

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  return data;
}

export function FinanceManager(props: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(fn: () => Promise<unknown>) { setBusy(true); setMessage(""); try { await fn(); setMessage("Saved successfully."); window.location.reload(); } catch (err) { setMessage(err instanceof Error ? err.message : "Request failed"); } finally { setBusy(false); } }
  const form = (e: FormEvent<HTMLFormElement>) => new FormData(e.currentTarget);

  return <div className="management-stack">{message && <div className="notice">{message}</div>}
    {props.canInvoice && <section className="panel"><span className="eyebrow">RECEIVABLES</span><h2>Create invoice</h2><form className="form-grid compact-form" onSubmit={(e) => { e.preventDefault(); const f=form(e); void run(() => post("/api/invoices", { clientId:f.get("clientId"),total:f.get("total"),dueDate:f.get("dueDate"),description:f.get("description")||"Monthly service" })); }}><label>Client<select name="clientId" required>{props.clients.map(c=><option key={c.id} value={c.id}>{c.brandName}</option>)}</select></label><label>Total USD<input name="total" inputMode="decimal" required /></label><label>Due date<input name="dueDate" type="date" required /></label><label>Description<input name="description" defaultValue="Monthly service" /></label><button disabled={busy||!props.clients.length}>Create invoice</button></form></section>}

    {props.canPayment && <section className="panel"><span className="eyebrow">PAYMENTS</span><h2>Record payment</h2><form className="form-grid compact-form" onSubmit={(e) => { e.preventDefault(); const f=form(e); void run(() => post("/api/payments", { invoiceId:f.get("invoiceId"),amount:f.get("amount"),method:f.get("method"),reference:f.get("reference")||undefined })); }}><label>Invoice<select name="invoiceId" required>{props.invoices.map(i=><option key={i.id} value={i.id}>{i.number} · {i.client} · ${i.remaining} left</option>)}</select></label><label>Amount USD<input name="amount" inputMode="decimal" required /></label><label>Method<select name="method"><option>Cash</option><option>Bank Transfer</option><option>Card</option><option>Other</option></select></label><label>Reference<input name="reference" /></label><button disabled={busy||!props.invoices.length}>Record payment</button></form></section>}

    {props.canExpense && <section className="panel"><span className="eyebrow">EXPENSES</span><h2>Expense controls</h2><form className="form-grid compact-form" onSubmit={(e) => { e.preventDefault(); const f=form(e); void run(() => post("/api/expense-categories", { name:f.get("name") })); }}><label>New category<input name="name" required /></label><button disabled={busy}>Add category</button></form><hr/><form className="form-grid compact-form" onSubmit={(e) => { e.preventDefault(); const f=form(e); void run(() => post("/api/expenses", { description:f.get("description"),amount:f.get("amount"),date:f.get("date"),categoryId:f.get("categoryId"),vendor:f.get("vendor")||undefined,paymentMethod:f.get("paymentMethod")||undefined,clientId:f.get("clientId")||undefined,notes:f.get("notes")||undefined })); }}><label>Description<input name="description" required /></label><label>Amount USD<input name="amount" inputMode="decimal" required /></label><label>Date<input name="date" type="date" required /></label><label>Category<select name="categoryId" required>{props.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Vendor<input name="vendor" /></label><label>Payment method<input name="paymentMethod" /></label><label>Client (optional)<select name="clientId" defaultValue=""><option value="">Company expense</option>{props.clients.map(c=><option key={c.id} value={c.id}>{c.brandName}</option>)}</select></label><label>Notes<textarea name="notes" rows={2}/></label><button disabled={busy||!props.categories.length}>Add expense</button></form></section>}

    {props.canSalary && <section className="panel"><span className="eyebrow">PAYROLL</span><h2>Salaries</h2><form className="form-grid compact-form" onSubmit={(e) => { e.preventDefault(); const f=form(e); void run(() => post("/api/salary-profiles", { employeeId:f.get("employeeId"),baseSalary:f.get("baseSalary") })); }}><label>Employee<select name="employeeId" required>{props.employees.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label><label>Base salary USD<input name="baseSalary" inputMode="decimal" required /></label><button disabled={busy||!props.employees.length}>Save salary profile</button></form><hr/><form className="form-grid compact-form" onSubmit={(e) => { e.preventDefault(); const f=form(e); void run(() => post("/api/salaries", { profileId:f.get("profileId"),bonus:f.get("bonus")||"0",deduction:f.get("deduction")||"0",advance:f.get("advance")||"0",paymentDate:f.get("paymentDate"),notes:f.get("notes")||undefined })); }}><label>Salary profile<select name="profileId" required>{props.salaryProfiles.map(s=><option key={s.id} value={s.id}>{s.employee} · ${s.baseSalary}</option>)}</select></label><label>Payment date<input name="paymentDate" type="date" required /></label><label>Bonus<input name="bonus" inputMode="decimal" defaultValue="0" /></label><label>Deduction<input name="deduction" inputMode="decimal" defaultValue="0" /></label><label>Advance<input name="advance" inputMode="decimal" defaultValue="0" /></label><label>Notes<input name="notes" /></label><button disabled={busy||!props.salaryProfiles.length}>Record salary payment</button></form></section>}
  </div>;
}

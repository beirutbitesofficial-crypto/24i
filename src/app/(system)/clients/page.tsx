import { requirePageUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Badge, Empty } from "@/components/ui";
import { ClientManager } from "@/components/client-manager";
import { redirect } from "next/navigation";
import { SocialPublishingSettings } from "@/components/social-publishing-settings";
import { bufferConfigured } from "@/lib/buffer";
import { billingSummaries, packageOptions } from "@/lib/client-billing";
import { PackageCell, PaymentCell } from "@/components/client-billing";

export default async function Clients() {
  const user = await requirePageUser();
  if (!hasPermission(user, "clients.read")) redirect("/");
  const ids = assignedClientIds(user);
  const rows = await db.client.findMany({
    where: ids ? { id: { in: ids } } : {},
    include: {
      _count: { select: { projects: true, tasks: true, content: true } },
      users: { where: { user: { status: "ACTIVE", role: { key: "CLIENT" } } }, select: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { brandName: "asc" },
  });

  const isClient = user.role.key === "CLIENT";
  const ar = user.language === "AR";
  const canManagePublishing = ["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER"].includes(user.role.key);
  const canBill = !isClient && hasPermission(user, "packages.write") && hasPermission(user, "finance.invoices.write");
  const canPay = !isClient && hasPermission(user, "finance.payments.write");
  const showBilling = isClient ? hasPermission(user, "finance.client.read") : hasPermission(user, "finance.read") || canBill;
  const [billing, packages] = await Promise.all([
    showBilling ? billingSummaries(rows.map((r) => r.id)) : Promise.resolve(new Map()),
    canBill ? packageOptions() : Promise.resolve([]),
  ]);
  const socialChannels = canManagePublishing ? await db.socialChannel.findMany({ where: { provider: "BUFFER", ...(ids ? { clientId: { in: ids } } : {}) }, select: { id: true, clientId: true, channelId: true, service: true, name: true, autoPublish: true }, orderBy: { service: "asc" } }) : [];

  return <AppShell user={user} title={user.role.key === "CLIENT" ? "My company" : "Clients"} kicker="RELATIONSHIPS">
    <div className="management-stack">
      {hasPermission(user, "clients.write") && <ClientManager packages={packages} canBill={canBill} />}
      {canManagePublishing && <SocialPublishingSettings clients={rows.map((client) => ({ id: client.id, brandName: client.brandName }))} initialMappings={socialChannels} configured={bufferConfigured()} ar={user.language === "AR"} />}
      <div className="panel tablewrap">{rows.length ? <table><thead><tr><th>Brand</th><th>Contact</th><th>Status</th>{showBilling && <><th>Package</th><th>Payment</th></>}{!isClient && <th>Client login</th>}<th>Projects</th><th>Tasks</th><th>Content</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td><b>{x.brandName}</b><small>{x.industry || "—"}</small></td><td>{x.contactName}<small>{x.email}</small></td><td><Badge value={x.status} /></td>{showBilling && <><td><PackageCell clientId={x.id} summary={billing.get(x.id)} packages={packages} canEdit={canBill} /></td><td><PaymentCell clientId={x.id} summary={billing.get(x.id)} canPay={canPay} /></td></>}{!isClient && <td>{x.users.length ? <>{x.users.map((u) => u.user.name).join(", ")}<small>{x.users.map((u) => u.user.email).join(", ")}</small></> : <span title={ar ? "اربط حساب العميل من صفحة المستخدمين ليشوف المحتوى ويستلم الإشعارات" : "Link a client account from Users so they can see content and get notifications"}><Badge value="UNPAID" label={ar ? "ما في حساب مربوط" : "No login linked"} /></span>}</td>}<td>{x._count.projects}</td><td>{x._count.tasks}</td><td>{x._count.content}</td></tr>)}</tbody></table> : <Empty title={user.language === "AR" ? "لا يوجد عملاء بعد" : "No clients yet"} />}</div>
    </div>
  </AppShell>;
}

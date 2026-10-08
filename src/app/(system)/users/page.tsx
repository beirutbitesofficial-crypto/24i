import { redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { UserManagement } from "@/components/user-management";

export default async function UsersPage() {
  const actor = await requireUser();
  if (!hasPermission(actor, "users.read")) redirect("/");

  const [users, clients, roles] = await Promise.all([
    db.user.findMany({
      include: { role: true, clientUsers: { include: { client: true } } },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    db.client.findMany({ select: { id: true, brandName: true }, orderBy: { brandName: "asc" } }),
    db.role.findMany({ include: { permissions: true }, orderBy: { name: "asc" } }),
  ]);

  return <AppShell user={actor} title="User management" kicker="ACCESS CONTROL">
    <UserManagement
      actorRole={actor.role.key}
      clients={clients}
      initialUsers={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status,
        roleKey: u.role.key,
        roleName: u.role.name,
        clients: u.clientUsers.map((x) => ({ id: x.client.id, brandName: x.client.brandName })),
        lastLoginAt: u.lastLoginAt?.toISOString() || null,
        canEdit: actor.role.key === "ADMIN" || u.role.key !== "ADMIN",
      }))}
      initialRoles={roles.map((r) => ({
        key: r.key,
        name: r.name,
        permissions: r.permissions.map((p) => p.permission).sort(),
      }))}
    />
  </AppShell>;
}

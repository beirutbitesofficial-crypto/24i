"use client";

import { FormEvent, useMemo, useState } from "react";

type ClientOption = { id: string; brandName: string };
type RoleOption = { key: string; name: string; permissions: string[] };
type UserRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  roleKey: string;
  roleName: string;
  clients: ClientOption[];
  lastLoginAt: string | null;
  canEdit: boolean;
};

type Props = {
  initialUsers: UserRow[];
  clients: ClientOption[];
  initialRoles: RoleOption[];
  actorRole: string;
};

const permissionGroups = [
  ["People", ["users.read", "users.write", "roles.manage"]],
  ["Clients & projects", ["clients.read", "clients.write", "projects.read", "projects.write"]],
  ["Tasks", ["tasks.read", "tasks.write", "tasks.update"]],
  ["Content", ["content.read", "content.write", "content.upload", "content.approve", "content.schedule"]],
  ["Calendar & files", ["calendar.read", "calendar.write", "files.read", "files.write", "notifications.read"]],
  ["Finance", ["finance.read", "finance.client.read", "finance.invoices.write", "finance.payments.write", "finance.expenses.write", "finance.salaries.write", "finance.reports.read"]],
  ["System", ["audit.read", "settings.read", "settings.write"]],
] as const;

const pretty = (value: string) => value.replaceAll("_", " ").replaceAll(".", " · ");

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.formErrors?.[0] || data.error || "Request failed");
  return data;
}

export function UserManagement({ initialUsers, clients, initialRoles, actorRole }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [roles, setRoles] = useState(initialRoles);
  const [selectedId, setSelectedId] = useState(initialUsers[0]?.id || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = useMemo(() => users.find((u) => u.id === selectedId), [users, selectedId]);
  const canManageRoles = actorRole === "ADMIN";

  async function createUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMessage("");
    const form = new FormData(e.currentTarget);
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          roleKey: form.get("roleKey"),
          clientIds: form.getAll("clientIds"),
        }),
      });
      setMessage("User created successfully.");
      window.location.reload();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not create user"); }
    finally { setBusy(false); }
  }

  async function updateUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true); setMessage("");
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");
    try {
      await api(`/api/users/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.get("name"),
          roleKey: form.get("roleKey"),
          status: form.get("status"),
          clientIds: form.getAll("clientIds"),
          ...(password ? { password } : {}),
        }),
      });
      setMessage("User updated successfully.");
      window.location.reload();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not update user"); }
    finally { setBusy(false); }
  }

  async function saveRole(role: RoleOption) {
    setBusy(true); setMessage("");
    try {
      await api(`/api/roles/${role.key}/permissions`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: role.permissions }),
      });
      setMessage(`${role.name} permissions saved.`);
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not save permissions"); }
    finally { setBusy(false); }
  }

  function togglePermission(roleKey: string, permission: string, checked: boolean) {
    setRoles((current) => current.map((r) => r.key !== roleKey ? r : {
      ...r,
      permissions: checked ? [...new Set([...r.permissions, permission])] : r.permissions.filter((p) => p !== permission),
    }));
  }

  return <div className="management-stack">
    {message && <div className="notice">{message}</div>}

    <section className="panel">
      <div className="section-head"><div><span className="eyebrow">NEW ACCOUNT</span><h2>Create user</h2></div><span className="muted">Private account · role-based access</span></div>
      <form onSubmit={createUser} className="form-grid compact-form">
        <label>Name<input name="name" required minLength={2} /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Temporary password<input name="password" type="password" required minLength={8} /></label>
        <label>Role<select name="roleKey" required>{roles.filter((r) => actorRole === "ADMIN" || r.key !== "ADMIN").map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></label>
        <fieldset className="client-checks"><legend>Client access / assignments</legend>{clients.length ? clients.map((c) => <label className="check" key={c.id}><input type="checkbox" name="clientIds" value={c.id} />{c.brandName}</label>) : <span className="muted">No clients yet.</span>}</fieldset>
        <button disabled={busy}>Create user</button>
      </form>
    </section>

    <section className="panel">
      <div className="section-head"><div><span className="eyebrow">TEAM</span><h2>User management</h2></div><b>{users.length} accounts</b></div>
      <div className="user-layout">
        <div className="user-list">
          {users.map((u) => <button type="button" className={`user-card ${u.id === selectedId ? "active" : ""}`} key={u.id} onClick={() => setSelectedId(u.id)}>
            <span><b>{u.name}</b><small>{u.email}</small></span><span><em>{u.roleName}</em><small className={`status ${u.status.toLowerCase()}`}>{u.status}</small></span>
          </button>)}
        </div>
        {selected && <form key={selected.id} onSubmit={updateUser} className="user-editor">
          <h3>Edit {selected.name}</h3>
          <label>Name<input name="name" defaultValue={selected.name} required /></label>
          <label>Role<select name="roleKey" defaultValue={selected.roleKey} disabled={!selected.canEdit}>{roles.filter((r) => actorRole === "ADMIN" || r.key !== "ADMIN").map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</select></label>
          <label>Status<select name="status" defaultValue={selected.status} disabled={!selected.canEdit}><option>ACTIVE</option><option>PENDING</option><option>DISABLED</option></select></label>
          <label>Reset password <span className="muted">(optional)</span><input name="password" type="password" minLength={8} placeholder="Leave empty to keep current" disabled={!selected.canEdit} /></label>
          <fieldset className="client-checks"><legend>Assigned clients</legend>{clients.map((c) => <label className="check" key={c.id}><input type="checkbox" name="clientIds" value={c.id} defaultChecked={selected.clients.some((x) => x.id === c.id)} disabled={!selected.canEdit} />{c.brandName}</label>)}</fieldset>
          <div className="meta-line"><span>Last login</span><b>{selected.lastLoginAt ? new Date(selected.lastLoginAt).toLocaleString() : "Never"}</b></div>
          <button disabled={busy || !selected.canEdit}>Save user</button>
        </form>}
      </div>
    </section>

    <section className="panel">
      <div className="section-head"><div><span className="eyebrow">RBAC</span><h2>Roles & access</h2></div><span className="muted">Enforced server-side</span></div>
      <div className="role-tabs">
        {roles.map((role) => <article className="role-card" key={role.key}>
          <div className="role-title"><div><h3>{role.name}</h3><small>{role.key === "ADMIN" ? "Unrestricted system access" : `${role.permissions.length} permissions`}</small></div>{canManageRoles && role.key !== "ADMIN" && <button type="button" className="secondary small-button" disabled={busy} onClick={() => saveRole(role)}>Save</button>}</div>
          {role.key === "ADMIN" ? <p className="muted">Admin can access users, roles, clients, production, approvals, files, finance, salaries, audit logs and settings without restriction.</p> : <div className="permission-groups">{permissionGroups.map(([group, perms]) => <fieldset key={group}><legend>{group}</legend>{perms.map((permission) => <label className="check" key={permission}><input type="checkbox" checked={role.permissions.includes(permission)} disabled={!canManageRoles} onChange={(e) => togglePermission(role.key, permission, e.target.checked)} />{pretty(permission)}</label>)}</fieldset>)}</div>}
        </article>)}
      </div>
    </section>
  </div>;
}

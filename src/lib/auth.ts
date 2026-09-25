import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

export class AuthError extends Error {
  constructor(public status: 401 | 403) {
    super(status === 401 ? "UNAUTHORIZED" : "FORBIDDEN");
  }
}

const key = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
};
// Only external CLIENT accounts are client-scoped. Internal agency roles can work
// across the client list, while role permissions and content ownership still
// control what they can change.
const scopedRoles = new Set(["CLIENT"]);

export const hashPassword = (password: string) =>
  argon2.hash(password, { type: argon2.argon2id });
export const verifyPassword = (hash: string, password: string) =>
  argon2.verify(hash, password);

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
  (await cookies()).set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 604800,
  });
}

export async function currentUser() {
  const token = (await cookies()).get("session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return db.user.findFirst({
      where: { id: String(payload.sub), status: "ACTIVE" },
      include: {
        role: { include: { permissions: true } },
        clientUsers: true,
      },
    });
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AuthError(401);
  return user;
}

// For server components: send signed-out visitors to the login screen.
export async function requirePageUser() {
  const user = await currentUser();
  if (!user) redirect("/");
  return user;
}

export type SessionUser = Awaited<ReturnType<typeof requireUser>>;

export function isScoped(user: SessionUser) {
  return scopedRoles.has(user.role.key);
}

export function canAccessClient(user: SessionUser, clientId: string | null | undefined) {
  if (!isScoped(user)) return true;
  return Boolean(clientId && user.clientUsers.some((c) => c.clientId === clientId));
}

export function hasPermission(
  user: Awaited<ReturnType<typeof requireUser>>,
  permission: string
) {
  return (
    user.role.key === "ADMIN" ||
    user.role.permissions.some((p) => p.permission === permission)
  );
}

export function assignedClientIds(
  user: Awaited<ReturnType<typeof requireUser>>
) {
  return scopedRoles.has(user.role.key)
    ? user.clientUsers.map((x) => x.clientId)
    : undefined;
}

export async function authorize(permission: string, clientId?: string) {
  const user = await requireUser();
  if (!hasPermission(user, permission)) throw new AuthError(403);
  if (clientId && !canAccessClient(user, clientId)) throw new AuthError(403);
  return user;
}

// Like authorize, but for an existing record: scoped roles may not touch records without a client.
export async function authorizeRecord(permission: string, clientId: string | null) {
  const user = await authorize(permission);
  if (!canAccessClient(user, clientId)) throw new AuthError(403);
  return user;
}

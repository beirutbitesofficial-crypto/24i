import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);
const scopedRoles = new Set(["CLIENT", "EDITOR", "SOCIAL_MEDIA_MANAGER"]);

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
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
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
  if (!hasPermission(user, permission)) throw new Error("FORBIDDEN");

  if (
    clientId &&
    scopedRoles.has(user.role.key) &&
    !user.clientUsers.some((c) => c.clientId === clientId)
  ) {
    throw new Error("FORBIDDEN");
  }

  return user;
}

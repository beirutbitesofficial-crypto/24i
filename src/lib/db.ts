import { PrismaClient } from "@prisma/client";

// Supabase's pooler allows only 15 connections in session mode (port 5432), shared by every
// running copy of the app. Prisma opens (CPUs * 2 + 1) connections per process by default,
// so a couple of processes exhaust it ("EMAXCONNSESSION max clients reached").
// Transaction mode (port 6543) shares connections between requests and has a much higher
// client limit, so pooler URLs are moved to it, with the settings Prisma needs there.
// Set DB_POOL_MODE=session to keep the URL as-is, or DB_CONNECTION_LIMIT to override.
export function tuneDatabaseUrl(raw: string | undefined, env: Record<string, string | undefined> = process.env) {
  if (!raw) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const isPooler = url.hostname.endsWith(".pooler.supabase.com");
  if (isPooler && env.DB_POOL_MODE !== "session" && (url.port === "5432" || url.port === "")) url.port = "6543";
  const transactionMode = isPooler && url.port === "6543";
  if (transactionMode && !url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", env.DB_CONNECTION_LIMIT || (isPooler && !transactionMode ? "2" : "5"));
  }
  if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
  return url.toString();
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const url = tuneDatabaseUrl(process.env.DATABASE_URL);
export const db = globalForPrisma.prisma ?? new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
globalForPrisma.prisma = db;

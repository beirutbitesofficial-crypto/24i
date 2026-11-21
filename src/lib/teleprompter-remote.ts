import { randomInt } from "node:crypto";
import { db } from "./db";
import { ensureTeleprompterRemoteTables } from "./db-upgrades";

export const REMOTE_COMMANDS = ["toggle", "play", "pause", "faster", "slower", "forward", "back", "restart", "bigger", "smaller", "mirror", "speed"] as const;
export type RemoteCommand = (typeof REMOTE_COMMANDS)[number];

// No look-alike characters (0/O, 1/I/L) so a code read off a screen is typed right.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_PATTERN = /^[A-HJ-KM-NP-Z2-9]{6}$/;
const LIFETIME_HOURS = 12;

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function createRemote(ownerId: string) {
  await ensureTeleprompterRemoteTables();
  await db.$executeRaw`DELETE FROM "TeleprompterCommand" WHERE "createdAt" < now() - interval '1 day'`;
  await db.$executeRaw`DELETE FROM "TeleprompterRemote" WHERE "createdAt" < now() - interval '1 day'`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    const inserted = await db.$executeRaw`INSERT INTO "TeleprompterRemote" ("code", "ownerId") VALUES (${code}, ${ownerId}) ON CONFLICT DO NOTHING`;
    if (inserted) return code;
  }
  throw new Error("Could not create a remote code");
}

type RemoteRow = { code: string; ownerId: string; state: unknown; stateAt: Date | null; remoteAt: Date | null };

// A live remote: created in the last 12 hours.
export async function findRemote(code: string) {
  await ensureTeleprompterRemoteTables();
  const rows = await db.$queryRaw<RemoteRow[]>`SELECT "code", "ownerId", "state", "stateAt", "remoteAt" FROM "TeleprompterRemote" WHERE "code" = ${code} AND "createdAt" > now() - make_interval(hours => ${LIFETIME_HOURS}::int)`;
  return rows[0] ?? null;
}

// Best-effort brake on a phone stuck sending commands (per server process).
const recent = new Map<string, number[]>();
export function allowCommand(code: string) {
  const now = Date.now();
  const list = (recent.get(code) || []).filter((t) => now - t < 10_000);
  if (list.length >= 60) return false;
  list.push(now);
  recent.set(code, list);
  return true;
}

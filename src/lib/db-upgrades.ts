import { db } from "./db";

// The Hostinger build only runs `prisma generate`, so new tables are created here the first
// time they are needed. The SQL is the same as prisma/migrations/2_chat and is idempotent.
const CHAT_SQL = [
  `CREATE TABLE IF NOT EXISTS "ChatMessage" ("id" TEXT NOT NULL, "clientId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "toRole" TEXT, "body" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id"))`,
  `CREATE TABLE IF NOT EXISTS "ChatRead" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "clientId" TEXT NOT NULL, "lastReadAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ChatRead_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "ChatMessage_clientId_createdAt_idx" ON "ChatMessage"("clientId", "createdAt")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ChatRead_userId_clientId_key" ON "ChatRead"("userId", "clientId")`,
  `DO $$ BEGIN ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "ChatRead" ADD CONSTRAINT "ChatRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "ChatRead" ADD CONSTRAINT "ChatRead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

let chatReady: Promise<void> | null = null;

export function ensureChatTables() {
  chatReady ??= (async () => {
    const [{ exists }] = await db.$queryRaw<{ exists: boolean }[]>`SELECT to_regclass('"ChatRead"') IS NOT NULL AS "exists"`;
    if (exists) return;
    for (const sql of CHAT_SQL) await db.$executeRawUnsafe(sql);
  })().catch((error) => {
    chatReady = null;
    throw error;
  });
  return chatReady;
}

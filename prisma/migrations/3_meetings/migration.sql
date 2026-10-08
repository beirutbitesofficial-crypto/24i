-- CreateTable
CREATE TABLE IF NOT EXISTS "MeetingRequest" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "managerNote" TEXT,
    "clientNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingRequest_token_key" ON "MeetingRequest"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeetingRequest_status_date_idx" ON "MeetingRequest"("status", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MeetingRequest_date_time_idx" ON "MeetingRequest"("date", "time");

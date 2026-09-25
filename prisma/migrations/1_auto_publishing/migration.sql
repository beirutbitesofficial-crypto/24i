-- CreateTable
CREATE TABLE "SocialChannel" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'BUFFER',
    "service" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "autoPublish" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishingAttempt" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "socialChannelId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'BUFFER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerPostId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialChannel_clientId_active_idx" ON "SocialChannel"("clientId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "SocialChannel_provider_channelId_key" ON "SocialChannel"("provider", "channelId");

-- CreateIndex
CREATE INDEX "PublishingAttempt_contentId_status_idx" ON "PublishingAttempt"("contentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PublishingAttempt_contentId_socialChannelId_key" ON "PublishingAttempt"("contentId", "socialChannelId");

-- AddForeignKey
ALTER TABLE "SocialChannel" ADD CONSTRAINT "SocialChannel_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingAttempt" ADD CONSTRAINT "PublishingAttempt_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishingAttempt" ADD CONSTRAINT "PublishingAttempt_socialChannelId_fkey" FOREIGN KEY ("socialChannelId") REFERENCES "SocialChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;


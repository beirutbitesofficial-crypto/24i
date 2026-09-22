import { db } from "@/lib/db";
import { createBufferPost, getBufferPost, bufferConfigured } from "@/lib/buffer";
import { signPublishAsset } from "@/lib/storage";
import { notify } from "@/lib/notifications";

function normalizedPlatform(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function postText(caption: { caption: string; hashtags: string | null; cta: string | null }) {
  return [caption.caption, caption.hashtags, caption.cta].filter(Boolean).join("\n\n");
}

function instagramMetadata(type: string) {
  const value = type === "STORY" ? "story" : type === "REEL" ? "reel" : "post";
  return { instagram: { type: value, shouldShareToFeed: value !== "story" } };
}

export async function publishApprovedContent(contentId: string) {
  if (!bufferConfigured()) return { skipped: "BUFFER_API_KEY_MISSING" as const };

  const content = await db.contentItem.findUnique({
    where: { id: contentId },
    include: {
      client: { include: { socialChannels: { where: { active: true, autoPublish: true, provider: "BUFFER" } } } },
      versions: { include: { slides: { orderBy: { position: "asc" } } }, orderBy: { version: "desc" }, take: 1 },
      captions: { orderBy: { version: "desc" }, take: 1 },
    },
  });

  if (!content) throw new Error("CONTENT_NOT_FOUND");
  const version = content.versions[0];
  const caption = content.captions[0];
  if (!version || !caption) throw new Error("CONTENT_NOT_READY_FOR_PUBLISHING");

  const platformSet = new Set(content.platform.map(normalizedPlatform));
  const channels = content.client.socialChannels.filter((channel) => {
    const service = normalizedPlatform(channel.service);
    return platformSet.size === 0 || platformSet.has(service);
  });

  if (!channels.length) return { skipped: "NO_MATCHING_AUTO_PUBLISH_CHANNELS" as const };

  const fileIds = [...new Set([
    version.fileId,
    ...version.slides.map((slide) => slide.fileId),
  ].filter((id): id is string => Boolean(id)))];

  const files = await db.fileObject.findMany({
    where: { id: { in: fileIds }, deletedAt: null },
  });
  const fileMap = new Map(files.map((file) => [file.id, file]));

  const orderedFiles = version.slides.length
    ? version.slides.map((slide) => fileMap.get(slide.fileId)).filter((file): file is NonNullable<typeof file> => Boolean(file))
    : version.fileId
      ? [fileMap.get(version.fileId)].filter((file): file is NonNullable<typeof file> => Boolean(file))
      : [];

  if (!orderedFiles.length) throw new Error("PUBLISH_MEDIA_NOT_AVAILABLE");

  const assets = await Promise.all(orderedFiles.map(async (file) => {
    const url = await signPublishAsset(file.key, file.mimeType);
    if (file.mimeType.startsWith("video/")) return { video: { url, metadata: { thumbnailOffset: 1000 } } };
    if (file.mimeType.startsWith("image/")) return { image: { url } };
    throw new Error(`UNSUPPORTED_PUBLISH_MEDIA_${file.mimeType}`);
  }));

  const text = postText(caption);

  const results = await Promise.all(channels.map(async (channel) => {
    const existing = await db.publishingAttempt.findUnique({
      where: { contentId_socialChannelId: { contentId, socialChannelId: channel.id } },
    });

    if (existing?.providerPostId && ["SUBMITTED", "PUBLISHED"].includes(existing.status)) {
      return existing;
    }

    const attempt = await db.publishingAttempt.upsert({
      where: { contentId_socialChannelId: { contentId, socialChannelId: channel.id } },
      create: {
        contentId,
        socialChannelId: channel.id,
        provider: "BUFFER",
        status: "PENDING",
        attempts: 1,
      },
      update: {
        status: "PENDING",
        error: null,
        attempts: { increment: 1 },
      },
    });

    try {
      const post = await createBufferPost({
        channelId: channel.channelId,
        text,
        assets,
        metadata: normalizedPlatform(channel.service) === "instagram" ? instagramMetadata(content.type) : undefined,
      });
      const sent = post.status === "sent" || Boolean(post.sentAt);
      return await db.publishingAttempt.update({
        where: { id: attempt.id },
        data: {
          status: sent ? "PUBLISHED" : "SUBMITTED",
          providerPostId: post.id,
          publishedAt: sent ? new Date(post.sentAt || Date.now()) : null,
          error: null,
        },
      });
    } catch (error) {
      return await db.publishingAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message.slice(0, 2000) : "Unknown publishing error",
        },
      });
    }
  }));

  const failed = results.filter((item) => item.status === "FAILED");
  const pending = results.filter((item) => item.status === "SUBMITTED" || item.status === "PENDING");
  const published = results.filter((item) => item.status === "PUBLISHED");

  if (!failed.length && !pending.length && published.length === results.length) {
    await db.contentItem.update({
      where: { id: contentId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
  } else if (!failed.length && pending.length) {
    await db.contentItem.update({
      where: { id: contentId },
      data: { status: "SCHEDULED" },
    });
  }

  if (failed.length) {
    const recipients = await db.user.findMany({
      where: { status: "ACTIVE", role: { key: { in: ["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER"] } } },
      select: { id: true },
    });
    if (recipients.length) {
      await notify(recipients.map((item) => item.id), {
        kind: "SYSTEM",
        title: "Automatic publishing needs attention",
        body: `${content.client.brandName}: ${content.title} failed on ${failed.length} channel(s). Other channels were not duplicated.`,
        deepLink: `/content/${contentId}`,
      });
    }
  }

  return { published: published.length, submitted: pending.length, failed: failed.length };
}

export async function reconcilePublishingAttempts(contentId?: string) {
  if (!bufferConfigured()) return { checked: 0, updated: 0 };

  const attempts = await db.publishingAttempt.findMany({
    where: {
      status: "SUBMITTED",
      providerPostId: { not: null },
      ...(contentId ? { contentId } : {}),
    },
  });

  let updated = 0;
  for (const attempt of attempts) {
    try {
      const post = await getBufferPost(attempt.providerPostId!);
      if (post.status === "sent" || post.sentAt) {
        await db.publishingAttempt.update({
          where: { id: attempt.id },
          data: { status: "PUBLISHED", publishedAt: new Date(post.sentAt || Date.now()), error: null },
        });
        updated += 1;
      } else if (post.status === "error") {
        await db.publishingAttempt.update({
          where: { id: attempt.id },
          data: { status: "FAILED", error: "Buffer reported a publishing error" },
        });
        updated += 1;
      }
    } catch (error) {
      await db.publishingAttempt.update({
        where: { id: attempt.id },
        data: { error: error instanceof Error ? error.message.slice(0, 2000) : "Could not check Buffer status" },
      });
    }
  }

  const contentIds = [...new Set(attempts.map((attempt) => attempt.contentId))];
  for (const id of contentIds) {
    const all = await db.publishingAttempt.findMany({ where: { contentId: id } });
    if (all.length && all.every((item) => item.status === "PUBLISHED")) {
      await db.contentItem.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    }
  }

  return { checked: attempts.length, updated };
}

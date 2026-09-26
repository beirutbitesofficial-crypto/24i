import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";

// Environment values are often pasted with stray spaces or quotes; tolerate that.
const clean = (value?: string) => value?.trim().replace(/^["']|["']$/g, "").trim() || undefined;

// Accepts "https://<id>.r2.cloudflarestorage.com", a bare host, or a URL with the bucket
// appended, and returns just the origin the S3 client expects.
export function normalizeEndpoint(value?: string) {
  const raw = clean(value);
  if (!raw) return undefined;
  try {
    return new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`).origin;
  } catch {
    return null;
  }
}

const bucket = clean(process.env.S3_BUCKET)!;
const normalizedEndpoint = normalizeEndpoint(process.env.S3_ENDPOINT);
// null = S3_ENDPOINT is set but unusable. Reported on upload instead of crashing every page.
const endpointInvalid = normalizedEndpoint === null;
const endpoint = normalizedEndpoint ?? undefined;
const accessKeyId = clean(process.env.S3_ACCESS_KEY_ID);
const s3 = new S3Client({
  endpoint,
  region: clean(process.env.S3_REGION) || "us-east-1",
  forcePathStyle: Boolean(endpoint),
  credentials: accessKeyId
    ? {
        accessKeyId,
        secretAccessKey: clean(process.env.S3_SECRET_ACCESS_KEY)!,
      }
    : undefined,
});

const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "application/pdf",
  "audio/mpeg",
  "audio/wav",
]);

export function validateUpload(type: string, size: number) {
  if (!allowed.has(type)) throw new Error("UNSUPPORTED_FILE_TYPE");
  // Do not impose an app-level maximum. Supabase Storage's project/global
  // limit remains the source of truth, so large production videos are allowed.
  if (!Number.isFinite(size) || size < 1) throw new Error("INVALID_FILE_SIZE");
}

export async function signUpload(clientId: string, name: string, type: string, size: number) {
  if (endpointInvalid) throw new Error("STORAGE_ENDPOINT_INVALID");
  if (!bucket || !accessKeyId) throw new Error("STORAGE_NOT_CONFIGURED");
  validateUpload(type, size);
  const ext = name.includes(".")
    ? name.slice(name.lastIndexOf(".")).replace(/[^.a-z0-9]/gi, "").slice(0, 10)
    : "";
  const key = `clients/${clientId}/${crypto.randomUUID()}${ext}`;

  // Do not sign Content-Length. Browsers control that header themselves and
  // Safari can otherwise produce a request that fails SigV4 verification.
  // Content-Type is still sent by the browser on the actual PUT request.
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 }
  );

  return { key, url };
}

export const isAllowedType = (type: string) => allowed.has(type);

// Returns the stored object's real type and size, or null if the object does not exist.
// Used so file records reflect what is actually in storage, not what the browser claimed.
export async function statUpload(key: string) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return {
      mimeType: (head.ContentType ?? "").split(";")[0].trim().toLowerCase(),
      size: head.ContentLength ?? 0,
    };
  } catch {
    return null;
  }
}

export async function signDownload(key: string, filename?: string) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: filename ? `attachment; filename="${filename.replace(/["\\\r\n]/g, "_")}"` : undefined,
    }),
    { expiresIn: 120 },
  );
}

export async function signPreview(key: string, mimeType: string) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: mimeType,
      ResponseContentDisposition: "inline",
    }),
    // Long enough for slow video players (e.g. iPhone Safari fetching an MP4 in many byte ranges),
    // which keep reusing the signed URL after the redirect.
    { expiresIn: 3600 }
  );
}

export async function signPublishAsset(key: string, mimeType: string) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: mimeType,
      ResponseContentDisposition: "inline",
    }),
    { expiresIn: 86400 }
  );
}

export async function deleteStoredObject(key: string) {
  if (!bucket) throw new Error("STORAGE_NOT_CONFIGURED");
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

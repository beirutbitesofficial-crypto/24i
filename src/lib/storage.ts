import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";

const bucket = process.env.S3_BUCKET!;
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  credentials: process.env.S3_ACCESS_KEY_ID ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } : undefined,
});

const allowed = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "application/pdf", "audio/mpeg", "audio/wav"]);
const MAX_SIZE = 500 * 1024 * 1024;

export function validateUpload(type: string, size: number) {
  if (!allowed.has(type)) throw new Error("UNSUPPORTED_FILE_TYPE");
  if (size < 1 || size > MAX_SIZE) throw new Error("INVALID_FILE_SIZE");
}

export async function signUpload(clientId: string, name: string, type: string, size: number) {
  validateUpload(type, size);
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")).replace(/[^.a-z0-9]/gi, "").slice(0, 10) : "";
  const key = `clients/${clientId}/${crypto.randomUUID()}${ext}`;
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: type, ContentLength: size }), { expiresIn: 300 });
  return { key, url };
}

// Returns the stored object's real type and size, or null if it does not exist / is not allowed.
export async function statUpload(key: string) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const mimeType = head.ContentType ?? "";
    const size = head.ContentLength ?? 0;
    validateUpload(mimeType, size);
    return { mimeType, size };
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

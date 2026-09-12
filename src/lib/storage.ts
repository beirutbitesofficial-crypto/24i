import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";

const bucket = process.env.S3_BUCKET!;
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  credentials: process.env.S3_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
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
  validateUpload(type, size);
  const ext = name.includes(".")
    ? name.slice(name.lastIndexOf(".")).replace(/[^.a-z0-9]/gi, "")
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

export async function signDownload(key: string) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 120 });
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
    { expiresIn: 120 }
  );
}

export async function deleteStoredObject(key: string) {
  if (!bucket) throw new Error("STORAGE_NOT_CONFIGURED");
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

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

export type StorageCheck = { step: string; ok: boolean; detail: string };

const describe = (error: unknown) => {
  const e = error as { name?: string; Code?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const code = e?.Code || e?.name || "Error";
  const status = e?.$metadata?.httpStatusCode ? ` (HTTP ${e.$metadata.httpStatusCode})` : "";
  return `${code}${status}: ${e?.message || "unknown error"}`;
};

const hints: Record<string, string> = {
  NoSuchBucket: "The bucket in S3_BUCKET does not exist in this account. Check the exact bucket name.",
  InvalidAccessKeyId: "S3_ACCESS_KEY_ID is wrong or the token was deleted.",
  SignatureDoesNotMatch: "S3_SECRET_ACCESS_KEY does not match the Access Key ID.",
  AccessDenied: "The token cannot write to this bucket. Give it Object Read & Write on this bucket.",
  Unauthorized: "The token cannot access this bucket. Give it Object Read & Write on this bucket.",
};

// Runs the same steps a browser upload needs, from the server, and reports the first failure
// with a human-readable hint. Used by the admin "Test storage" button.
export async function diagnoseStorage(siteOrigin: string): Promise<StorageCheck[]> {
  const checks: StorageCheck[] = [];
  const missing = [
    !bucket && "S3_BUCKET",
    !accessKeyId && "S3_ACCESS_KEY_ID",
    !clean(process.env.S3_SECRET_ACCESS_KEY) && "S3_SECRET_ACCESS_KEY",
  ].filter(Boolean);
  if (endpointInvalid) {
    checks.push({ step: "Settings", ok: false, detail: "S3_ENDPOINT is not a valid address. It should look like https://<account-id>.r2.cloudflarestorage.com" });
    return checks;
  }
  if (missing.length) {
    checks.push({ step: "Settings", ok: false, detail: `Missing: ${missing.join(", ")}` });
    return checks;
  }
  checks.push({ step: "Settings", ok: true, detail: `Bucket "${bucket}" at ${endpoint ?? "AWS S3"}, region ${clean(process.env.S3_REGION) || "us-east-1"}` });

  const key = `healthchecks/${crypto.randomUUID()}.txt`;
  try {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "ok", ContentType: "text/plain" }));
    checks.push({ step: "Keys & bucket", ok: true, detail: "The server can write to the bucket." });
  } catch (error) {
    const code = (error as { Code?: string; name?: string })?.Code || (error as { name?: string })?.name || "";
    checks.push({ step: "Keys & bucket", ok: false, detail: `${hints[code] ?? "Storage rejected the request."} (${describe(error)})` });
    return checks;
  }

  try {
    const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
    const res = await fetch(url, { method: "PUT", headers: { "content-type": "text/plain" }, body: "ok" });
    checks.push(res.ok
      ? { step: "Upload link", ok: true, detail: "A signed upload link works." }
      : { step: "Upload link", ok: false, detail: `Signed upload was rejected with HTTP ${res.status}. ${(await res.text()).slice(0, 200)}` });
  } catch (error) {
    checks.push({ step: "Upload link", ok: false, detail: describe(error) });
  }

  try {
    const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
    const res = await fetch(url, {
      method: "OPTIONS",
      headers: { origin: siteOrigin, "access-control-request-method": "PUT", "access-control-request-headers": "content-type" },
    });
    const allowOrigin = res.headers.get("access-control-allow-origin");
    const ok = res.ok && (allowOrigin === "*" || allowOrigin === siteOrigin);
    checks.push(ok
      ? { step: "CORS (browser uploads)", ok: true, detail: `Browsers on ${siteOrigin} are allowed to upload.` }
      : { step: "CORS (browser uploads)", ok: false, detail: `Browsers on ${siteOrigin} are blocked (HTTP ${res.status}, allow-origin: ${allowOrigin ?? "none"}). Add a CORS policy on bucket "${bucket}" allowing this origin with methods GET, PUT, HEAD and headers *.` });
  } catch (error) {
    checks.push({ step: "CORS (browser uploads)", ok: false, detail: describe(error) });
  }

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
  return checks;
}

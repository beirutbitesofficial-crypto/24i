import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Short, clean, time-limited public links for media that is being published.
// Social networks (Instagram/Meta via Buffer) reject storage presigned URLs, so we hand them
// a link on our own domain: /api/media/<fileId>/<expires>/<signature>/<name.ext>.
// Storage itself stays private; only holders of a valid signature can fetch that one file.

const PUBLIC_MEDIA_TTL_SECONDS = 7 * 24 * 60 * 60;

function signingKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return createHash("sha256").update(`public-media:${secret}`).digest();
}

const signature = (fileId: string, expires: number) =>
  createHmac("sha256", signingKey()).update(`${fileId}:${expires}`).digest("base64url");

function safeName(originalName: string, key: string) {
  const ext = (key.match(/\.[a-z0-9]{1,10}$/i)?.[0] || originalName.match(/\.[a-z0-9]{1,10}$/i)?.[0] || "").toLowerCase();
  const base = originalName.replace(/\.[^.]*$/, "").normalize("NFKD").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "media";
  return `${base}${ext}`;
}

export function createPublicMediaUrl(file: { id: string; key: string; originalName: string }, baseUrl: string) {
  const expires = Math.floor(Date.now() / 1000) + PUBLIC_MEDIA_TTL_SECONDS;
  return `${baseUrl.replace(/\/$/, "")}/api/media/${file.id}/${expires}/${signature(file.id, expires)}/${safeName(file.originalName, file.key)}`;
}

export function verifyPublicMedia(fileId: string, expiresRaw: string, sig: string) {
  const expires = Number(expiresRaw);
  if (!Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(signature(fileId, expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// The public address of this site as seen by the outside world (behind Hostinger's proxy).
export function publicBaseUrl(req: Request) {
  const configured = process.env.APP_URL?.trim().replace(/^["']|["']$/g, "");
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || (/localhost|127\.0\.0\.1/.test(host) ? "http" : "https");
  return `${proto}://${host.split(",")[0].trim()}`;
}

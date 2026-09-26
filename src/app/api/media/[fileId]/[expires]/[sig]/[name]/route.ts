import { db } from "@/lib/db";
import { verifyPublicMedia } from "@/lib/public-media";
import { openStoredObject } from "@/lib/storage";

type Params = { params: Promise<{ fileId: string; expires: string; sig: string; name: string }> };

// Public, signed, time-limited media link used when publishing to social networks.
async function serve(req: Request, { params }: Params, headOnly: boolean) {
  const { fileId, expires, sig } = await params;
  if (!verifyPublicMedia(fileId, expires, sig)) return new Response("Link expired or invalid", { status: 403 });

  const file = await db.fileObject.findFirst({ where: { id: fileId, deletedAt: null }, select: { key: true, mimeType: true } });
  if (!file) return new Response("Not found", { status: 404 });

  try {
    const object = await openStoredObject(file.key, req.headers.get("range"));
    const headers = new Headers({
      "content-type": file.mimeType,
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=86400",
      "content-disposition": "inline",
    });
    if (object.ContentLength != null) headers.set("content-length", String(object.ContentLength));
    if (object.ContentRange) headers.set("content-range", object.ContentRange);
    if (object.ETag) headers.set("etag", object.ETag);
    const status = object.ContentRange ? 206 : 200;
    if (headOnly || !object.Body) return new Response(null, { status, headers });
    return new Response(object.Body.transformToWebStream(), { status, headers });
  } catch (error) {
    const code = (error as { name?: string })?.name;
    if (code === "NoSuchKey" || code === "NotFound") return new Response("Not found", { status: 404 });
    if (code === "InvalidRange") return new Response("Invalid range", { status: 416 });
    console.error("Public media error:", error);
    return new Response("Media unavailable", { status: 502 });
  }
}

export const GET = (req: Request, ctx: Params) => serve(req, ctx, false);
export const HEAD = (req: Request, ctx: Params) => serve(req, ctx, true);

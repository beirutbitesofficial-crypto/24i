import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { signUpload } from "@/lib/storage";

const schema = z.object({ clientId: z.string(), name: z.string().min(1).max(255), type: z.string(), size: z.number().int().positive() });

const messages: Record<string, string> = {
  UNSUPPORTED_FILE_TYPE: "This file type is not supported. Use JPG, PNG, WEBP, MP4, MOV, PDF, MP3 or WAV.",
  INVALID_FILE_SIZE: "This file is empty or its size could not be read.",
  STORAGE_ENDPOINT_INVALID: "Storage is misconfigured: S3_ENDPOINT must look like https://<account-id>.r2.cloudflarestorage.com",
  STORAGE_NOT_CONFIGURED: "Storage is not configured: set S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.",
};

async function handlePOST(req: Request) {
  const p = schema.safeParse(await req.json());
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });
  await authorize("files.write", p.data.clientId);
  try {
    return NextResponse.json(await signUpload(p.data.clientId, p.data.name, p.data.type, p.data.size));
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    console.error("Upload signing failed:", error);
    return NextResponse.json({ error: messages[code] ?? "Could not prepare the upload. Check the storage settings (S3_*) in Hostinger." }, { status: 400 });
  }
}

export const POST = api(handlePOST);

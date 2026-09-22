import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { bufferConfigured, listBufferChannels } from "@/lib/buffer";

export async function GET() {
  await authorize("settings.read");
  if (!bufferConfigured()) return NextResponse.json({ configured: false, groups: [] });

  try {
    const groups = await listBufferChannels();
    return NextResponse.json({ configured: true, groups });
  } catch (error) {
    return NextResponse.json(
      { configured: true, error: error instanceof Error ? error.message : "Could not load Buffer channels", groups: [] },
      { status: 502 }
    );
  }
}

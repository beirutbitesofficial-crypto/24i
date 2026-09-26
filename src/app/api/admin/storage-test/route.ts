import { api } from "@/lib/http";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { diagnoseStorage } from "@/lib/storage";

async function handlePOST(req: Request) {
  const user = await requireUser();
  if (user.role.key !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  // The origin the browser is using is the one CORS must allow.
  const origin = req.headers.get("origin") || new URL(req.url).origin;
  return NextResponse.json({ origin, checks: await diagnoseStorage(origin) });
}

export const POST = api(handlePOST);

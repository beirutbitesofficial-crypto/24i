import { api } from "@/lib/http";
import { cookies } from "next/headers"; import { NextResponse } from "next/server";
async function handlePOST(){(await cookies()).delete("session");return NextResponse.json({ok:true});}

export const POST = api(handlePOST);

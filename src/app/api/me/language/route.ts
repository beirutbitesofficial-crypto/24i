import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const schema=z.object({language:z.enum(["EN","AR"])});
export async function PATCH(req:Request){const p=schema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:"Invalid language"},{status:400});const user=await requireUser();await db.user.update({where:{id:user.id},data:{language:p.data.language}});return NextResponse.json({ok:true,language:p.data.language})}

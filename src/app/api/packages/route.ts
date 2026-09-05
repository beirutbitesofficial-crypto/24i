import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";

const schema=z.object({name:z.string().trim().min(1).max(120),price:z.string().regex(/^\d+(\.\d{1,2})?$/),interval:z.string().trim().min(1).max(30).default("MONTHLY"),entitlements:z.record(z.string(),z.unknown()).default({})});
export async function POST(req:Request){const p=schema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:p.error.flatten()},{status:400});const user=await authorize("packages.write");const row=await db.package.create({data:{name:p.data.name,price:money(p.data.price),interval:p.data.interval,entitlements:p.data.entitlements as any,active:true}});await db.auditLog.create({data:{userId:user.id,action:"PACKAGE_CREATED",entityType:"Package",entityId:row.id,newValue:{name:row.name,price:row.price.toString(),interval:row.interval}}});return NextResponse.json({...row,price:row.price.toString()},{status:201})}

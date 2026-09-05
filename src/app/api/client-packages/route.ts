import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/money";

const schema=z.object({clientId:z.string(),packageId:z.string(),startsAt:z.coerce.date(),endsAt:z.coerce.date().optional(),price:z.string().regex(/^\d+(\.\d{1,2})?$/).optional()});
export async function POST(req:Request){const p=schema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:p.error.flatten()},{status:400});const user=await authorize("packages.write");const pkg=await db.package.findUnique({where:{id:p.data.packageId}}),client=await db.client.findUnique({where:{id:p.data.clientId}});if(!pkg||!client)return NextResponse.json({error:"Client or package not found"},{status:404});const row=await db.$transaction(async tx=>{const assigned=await tx.clientPackage.create({data:{clientId:client.id,packageId:pkg.id,startsAt:p.data.startsAt,endsAt:p.data.endsAt,price:p.data.price?money(p.data.price):pkg.price,usage:{}}});await tx.auditLog.create({data:{userId:user.id,action:"CLIENT_PACKAGE_ASSIGNED",entityType:"ClientPackage",entityId:assigned.id,newValue:{clientId:client.id,packageId:pkg.id,price:assigned.price.toString()}}});return assigned});return NextResponse.json({...row,price:row.price.toString()},{status:201})}

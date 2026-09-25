import { api } from "@/lib/http";
import{NextResponse}from"next/server";import{z}from"zod";import{authorize}from"@/lib/auth";import{signUpload}from"@/lib/storage";
const schema=z.object({clientId:z.string(),name:z.string().min(1).max(255),type:z.string(),size:z.number().int().positive()});async function handlePOST(req:Request){const p=schema.safeParse(await req.json());if(!p.success)return NextResponse.json({error:p.error.flatten()},{status:400});await authorize("files.write",p.data.clientId);try{return NextResponse.json(await signUpload(p.data.clientId,p.data.name,p.data.type,p.data.size));}catch(e:any){return NextResponse.json({error:e.message},{status:400})}}

export const POST = api(handlePOST);

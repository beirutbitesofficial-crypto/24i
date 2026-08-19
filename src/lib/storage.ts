import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";

const bucket = process.env.S3_BUCKET!;
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  credentials: process.env.S3_ACCESS_KEY_ID ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } : undefined,
});

const allowed = new Set(["image/jpeg","image/png","image/webp","video/mp4","video/quicktime","application/pdf","audio/mpeg","audio/wav"]);
export function validateUpload(type:string,size:number){if(!allowed.has(type))throw new Error("UNSUPPORTED_FILE_TYPE");if(size<1||size>500*1024*1024)throw new Error("INVALID_FILE_SIZE");}
export async function signUpload(clientId:string,name:string,type:string,size:number){validateUpload(type,size);const ext=name.includes(".")?name.slice(name.lastIndexOf(".")).replace(/[^.a-z0-9]/gi,""):"";const key=`clients/${clientId}/${crypto.randomUUID()}${ext}`;return {key,url:await getSignedUrl(s3,new PutObjectCommand({Bucket:bucket,Key:key,ContentType:type,ContentLength:size}),{expiresIn:300})};}
export async function signDownload(key:string){return getSignedUrl(s3,new GetObjectCommand({Bucket:bucket,Key:key}),{expiresIn:120});}

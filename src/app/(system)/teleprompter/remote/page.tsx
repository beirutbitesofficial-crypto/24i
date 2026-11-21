import "../teleprompter.css";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { TeleprompterRemote } from "@/components/teleprompter-remote";

export const metadata: Metadata = { title: "Teleprompter remote" };

// Opened on a second phone to drive the teleprompter. No sign-in needed: the code shown on
// the teleprompter screen is what links the two.
export default async function RemotePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const user = await currentUser().catch(() => null);
  return <TeleprompterRemote initialCode={code ?? ""} ar={user ? user.language === "AR" : false} />;
}

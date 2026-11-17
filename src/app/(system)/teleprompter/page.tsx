import "./teleprompter.css";
import { redirect } from "next/navigation";
import { Noto_Naskh_Arabic, Noto_Sans_Arabic } from "next/font/google";
import { requirePageUser, hasPermission, assignedClientIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { Teleprompter } from "@/components/teleprompter";

// Extra Arabic faces with full tashkeel support; Inter and IBM Plex Sans Arabic come from the root layout.
const naskh = Noto_Naskh_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-naskh", display: "swap" });
const notoSans = Noto_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-noto-arabic", display: "swap" });

const allowedRoles = new Set(["ADMIN", "MANAGER", "SOCIAL_MEDIA_MANAGER", "EDITOR", "CLIENT", "PARTNER"]);

export default async function TeleprompterPage({ searchParams }: { searchParams: Promise<{ script?: string }> }) {
  const user = await requirePageUser();
  if (!hasPermission(user, "content.read") || !allowedRoles.has(user.role.key)) redirect("/");
  const ids = assignedClientIds(user);
  const { script } = await searchParams;

  const rows = await db.contentItem.findMany({
    where: { platform: { has: "SCRIPT" }, ...(ids ? { clientId: { in: ids } } : {}) },
    include: { client: { select: { brandName: true } }, captions: { orderBy: { version: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  const scripts = rows
    .filter((r) => r.captions[0]?.caption)
    .map((r) => ({ id: r.id, title: r.title, client: r.client.brandName, body: r.captions[0].caption }));

  return <AppShell user={user} title="Teleprompter" kicker="PRODUCTION">
    <Teleprompter scripts={scripts} initialScriptId={script} fontClassName={`${naskh.variable} ${notoSans.variable}`} ar={user.language === "AR"} />
  </AppShell>;
}

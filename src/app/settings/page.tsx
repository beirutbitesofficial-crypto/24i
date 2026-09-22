import { redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";
import { SocialPublishingSettings } from "@/components/social-publishing-settings";
import { bufferConfigured } from "@/lib/buffer";

export default async function SettingsPage() {
  const user = await requireUser();
  if (!hasPermission(user, "settings.read") && user.role.key !== "ADMIN") redirect("/");
  const [row, clients, socialChannels] = await Promise.all([
    db.setting.findUnique({ where: { key: "agency_profile" } }),
    db.client.findMany({ select: { id: true, brandName: true }, orderBy: { brandName: "asc" } }),
    db.socialChannel.findMany({ where: { provider: "BUFFER" }, select: { id: true, clientId: true, channelId: true, service: true, name: true, autoPublish: true }, orderBy: { service: "asc" } }),
  ]);
  const value = (row?.value || { companyName: "24i Production", currency: "USD", timezone: "Asia/Beirut", defaultLanguage: "EN" }) as { companyName: string; currency: "USD"; timezone: string; defaultLanguage: "EN" | "AR" };
  return <AppShell user={user} title="Settings" kicker="CONFIGURATION"><div className="management-stack"><SettingsForm initial={value} ar={user.language === "AR"}/><SocialPublishingSettings clients={clients} initialMappings={socialChannels} configured={bufferConfigured()} ar={user.language === "AR"}/></div></AppShell>;
}

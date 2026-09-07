import { redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const user = await requireUser();
  if (!hasPermission(user, "settings.read") && user.role.key !== "ADMIN") redirect("/");
  const row = await db.setting.findUnique({ where: { key: "agency_profile" } });
  const value = (row?.value || { companyName: "24i Production", currency: "USD", timezone: "Asia/Beirut", defaultLanguage: "EN" }) as { companyName: string; currency: "USD"; timezone: string; defaultLanguage: "EN" | "AR" };
  return <AppShell user={user} title="Settings" kicker="CONFIGURATION"><SettingsForm initial={value} ar={user.language === "AR"}/></AppShell>;
}

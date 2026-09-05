import { redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { NotificationList } from "@/components/notification-list";

export default async function NotificationsPage(){const user=await requireUser();if(!hasPermission(user,"notifications.read"))redirect("/");const rows=await db.notification.findMany({where:{userId:user.id},orderBy:{createdAt:"desc"},take:200});return <AppShell user={user} title="Notifications" kicker="INBOX"><NotificationList items={rows.map(n=>({id:n.id,title:n.title,body:n.body,deepLink:n.deepLink,kind:n.kind,createdAt:n.createdAt.toISOString(),readAt:n.readAt?.toISOString()||null}))}/></AppShell>}

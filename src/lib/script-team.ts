import { db } from "./db";

// Who hears about script activity: the client's social media managers (all SMMs when none
// is assigned) and every manager.
export async function scriptTeamRecipients(clientId: string, excludeUserId?: string) {
  let socialManagers = await db.user.findMany({
    where: { status: "ACTIVE", role: { key: "SOCIAL_MEDIA_MANAGER" }, clientUsers: { some: { clientId } } },
    select: { id: true },
  });
  if (!socialManagers.length) {
    socialManagers = await db.user.findMany({ where: { status: "ACTIVE", role: { key: "SOCIAL_MEDIA_MANAGER" } }, select: { id: true } });
  }
  const managers = await db.user.findMany({ where: { status: "ACTIVE", role: { key: "MANAGER" } }, select: { id: true } });
  return [...new Set([...socialManagers, ...managers].map((u) => u.id))].filter((id) => id !== excludeUserId);
}

import type { MeetingRequest } from "@prisma/client";
import { managerWhatsApp, sendWhatsApp, waLink } from "./whatsapp";

export const MEETING_ROLES = ["ADMIN", "MANAGER"];
/** A slot is taken while a request for it is pending or confirmed. */
export const BLOCKING_STATUSES = ["PENDING", "CONFIRMED"];

type Meeting = Pick<MeetingRequest, "name" | "phone" | "email" | "service" | "date" | "time" | "format" | "notes">;

export function formatMeetingDate(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const appUrl = () => (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://24iproduction.com").replace(/\/+$/, "");

export function managerMessage(m: Meeting) {
  const when = `${formatMeetingDate(m.date)} at ${m.time}`;
  const text = [
    "📅 New meeting request (pending)",
    `${m.name} · ${m.service}`,
    `${when} (Lebanon time) · ${m.format}`,
    `Phone: ${m.phone} · ${m.email}`,
    m.notes ? `Notes: ${m.notes}` : "",
    `Confirm: ${appUrl()}/meetings`,
  ].filter(Boolean).join("\n");
  return { text, params: [m.name, m.service, when, m.format, m.phone] };
}

export function clientMessage(m: Meeting, status: "CONFIRMED" | "DECLINED") {
  const when = `${formatMeetingDate(m.date)} at ${m.time}`;
  const text = status === "CONFIRMED"
    ? `Hi ${m.name}, your meeting with 24i Production is confirmed for ${when} (Lebanon time), ${m.format === "Video call" ? "by video call. We'll send you the link before we start." : "at our studio: Office 10, 3rd Floor, JMR Mall."} See you then!`
    : `Hi ${m.name}, unfortunately we can't make ${when}. We'll contact you shortly to find another time. — 24i Production`;
  return { text, params: status === "CONFIRMED" ? [m.name, when, m.format] : [m.name, when] };
}

export function notifyManagerOnWhatsApp(m: Meeting) {
  const { text, params } = managerMessage(m);
  return sendWhatsApp({ to: managerWhatsApp(), template: process.env.WHATSAPP_TEMPLATE_MANAGER || undefined, params, text });
}

export function notifyClientOnWhatsApp(m: Meeting, status: "CONFIRMED" | "DECLINED") {
  const { text, params } = clientMessage(m, status);
  const template = status === "CONFIRMED" ? process.env.WHATSAPP_TEMPLATE_CONFIRMED : process.env.WHATSAPP_TEMPLATE_DECLINED;
  return sendWhatsApp({ to: m.phone, template: template || undefined, params, text });
}

export const clientWhatsAppLink = (m: Meeting, status: "CONFIRMED" | "DECLINED") => waLink(m.phone, clientMessage(m, status).text);

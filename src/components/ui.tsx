import type { ReactNode } from "react";

export const humanize = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

// Maps every enum value used across the app to a colour tone.
const tones: Record<string, Tone> = {
  ACTIVE: "success", COMPLETED: "success", APPROVED: "success", CAPTION_APPROVED: "success", PAID: "success", PUBLISHED: "success", READY_TO_SCHEDULE: "success",
  SCHEDULED: "accent", IN_PROGRESS: "info", PRODUCTION: "info", UPLOAD: "info", CONTENT_PLAN: "info", REVIEW: "info", CLIENT_REVIEW: "info",
  WAITING: "warning", WAITING_CLIENT: "warning", WAITING_CLIENT_APPROVAL: "warning", PARTIALLY_PAID: "warning", PENDING: "warning", PENDING_PAYMENT: "warning", CONTRACT_ENDING: "warning", HIGH: "warning", LEAD: "info",
  REVISION: "danger", REVISION_REQUESTED: "danger", UNPAID: "danger", DISABLED: "danger", URGENT: "danger", OVERDUE: "danger",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return <span className={`badge badge-${tones[value] ?? "neutral"}`}>{label ?? humanize(value)}</span>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return <div className="empty"><Icon name="inbox" /><b>{title}</b>{hint && <span>{hint}</span>}</div>;
}

export function Card({ title, eyebrow, action, children, className = "" }: { title?: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>
    {(title || eyebrow || action) && <div className="section-head"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}{title && <h2>{title}</h2>}</div>{action}</div>}
    {children}
  </section>;
}

const paths: Record<string, string> = {
  dashboard: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z",
  bell: "M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Zm-8 4a2 2 0 0 0 4 0",
  users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm13 9v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8",
  briefcase: "M4 7h16v12H4zM9 7V5h6v2M4 12h16",
  folder: "M3 6h6l2 2h10v11H3z",
  check: "M9 11l3 3 8-8M20 12v7H4V5h11",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  file: "M6 3h8l4 4v14H6zM14 3v4h4",
  wallet: "M3 7h16v12H3zM3 7l12-4v4M16 13h.01",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  logout: "M15 17l5-5-5-5M20 12H9M12 21H4V3h8",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z",
  inbox: "M3 13h5l1 3h6l1-3h5M5 5h14l2 8v6H3v-6z",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14M13 6l6 6-6 6",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2",
  alert: "M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  download: "M12 3v12M7 10l5 5 5-5M4 21h16",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  script: "M8 3h9l3 3v15H8zM4 7v14h12M11 9h6M11 13h6M11 17h4",
  camera: "M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  menu: "M4 6h16M4 12h16M4 18h16",
};

export function Icon({ name, size = 18 }: { name: keyof typeof paths | string; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.file} /></svg>;
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join("");
}

export const usd = (value: { toFixed(n: number): string }) => `$${Number(value.toFixed(2)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Collapsible "create" form so list pages lead with data rather than a large form.
export function CreatePanel({ title, hint, children, defaultOpen = false }: { title: string; hint?: string; children: ReactNode; defaultOpen?: boolean }) {
  return <details className="panel disclosure" open={defaultOpen}>
    <summary>
      <span className="summary-title"><span className="summary-icon"><Icon name="plus" size={16} /></span><span><h2>{title}</h2>{hint && <span className="hint">{hint}</span>}</span></span>
      <span className="chev" aria-hidden="true">+</span>
    </summary>
    <div className="disclosure-body">{children}</div>
  </details>;
}

export function Notice({ message }: { message: string }) {
  if (!message) return null;
  const ok = /created|saved|uploaded|notified|success|recorded|updated|sent|^تم/i.test(message.trim());
  return <div className={`notice ${ok ? "success" : "error"}`} role={ok ? "status" : "alert"}>{message}</div>;
}

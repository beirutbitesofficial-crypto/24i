import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ensureMeetingTables } from "@/lib/db-upgrades";
import { formatMeetingDate } from "@/lib/meetings";
import { site } from "@/lib/website/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your meeting | 24i Production", robots: { index: false } };

const STATES = {
  PENDING: { label: "Pending confirmation", tone: "text-[#f5c542]", note: "The team has your request. You'll get a WhatsApp message as soon as it's confirmed." },
  CONFIRMED: { label: "Confirmed", tone: "text-teal-bright", note: "You're booked. The details are on their way to your WhatsApp." },
  DECLINED: { label: "Not available", tone: "text-rec", note: "We couldn't make this time. We'll contact you to find another one." },
} as const;

export default async function BookingStatus({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  await ensureMeetingTables();
  const meeting = t ? await db.meetingRequest.findFirst({ where: { id, token: t } }) : null;
  if (!meeting) notFound();
  const state = STATES[meeting.status as keyof typeof STATES] ?? STATES.PENDING;

  return (
    <main className="min-h-screen-d flex items-center justify-center bg-ink px-6 py-24 text-cream">
      <div className="w-full max-w-xl border border-cream/15 p-8 sm:p-12">
        <Link href="/website" className="font-wide text-xl">
          24i<span className="ml-2 font-mono text-[10px] font-normal uppercase tracking-[0.4em] [font-stretch:100%]">Production</span>
        </Link>
        <p className="mt-10 font-mono text-xs uppercase tracking-[0.4em] text-mute">Meeting request</p>
        <p className={`font-wide mt-3 text-3xl uppercase sm:text-4xl ${state.tone}`}>
          {meeting.status === "PENDING" && <span className="rec-blink mr-3 inline-block h-3 w-3 rounded-full bg-[#f5c542] align-middle" />}
          {state.label}
        </p>
        <p className="mt-4 text-cream/70">{state.note}</p>
        <dl className="mt-10 grid grid-cols-2 gap-6 font-mono text-xs uppercase tracking-[0.2em]">
          <div><dt className="text-mute">Date</dt><dd className="mt-2">{formatMeetingDate(meeting.date)}</dd></div>
          <div><dt className="text-mute">Time (Lebanon)</dt><dd className="mt-2">{meeting.time}</dd></div>
          <div><dt className="text-mute">Format</dt><dd className="mt-2">{meeting.format}</dd></div>
          <div><dt className="text-mute">Topic</dt><dd className="mt-2">{meeting.service}</dd></div>
          {meeting.format === "Studio visit" && (
            <div className="col-span-2"><dt className="text-mute">Where</dt><dd className="mt-2">{site.address}</dd></div>
          )}
        </dl>
        <p className="mt-10 text-xs text-mute">Keep this page bookmarked to check the status. Questions? WhatsApp {site.whatsapp}.</p>
      </div>
    </main>
  );
}

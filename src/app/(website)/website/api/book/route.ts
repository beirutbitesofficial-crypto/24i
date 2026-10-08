import type { NextRequest } from "next/server";
import { bookingSchema } from "@/lib/website/forms";
import { handleForm } from "@/lib/website/handle-form";

export async function POST(req: NextRequest) {
  return handleForm(req, "booking", bookingSchema, (d) => ({
    subject: `Meeting request: ${d.date} ${d.time} (Lebanon time) with ${d.name}`,
    replyTo: d.email,
    fields: {
      Name: d.name,
      Email: d.email,
      Phone: d.phone,
      Service: d.service,
      Date: d.date,
      "Time (Asia/Beirut)": d.time,
      Format: d.format,
      Notes: d.notes,
    },
  }));
}

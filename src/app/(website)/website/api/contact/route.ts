import type { NextRequest } from "next/server";
import { contactSchema } from "@/lib/website/forms";
import { handleForm } from "@/lib/website/handle-form";

export async function POST(req: NextRequest) {
  return handleForm(req, "contact", contactSchema, (d) => ({
    subject: `New enquiry: ${d.service} from ${d.name}`,
    replyTo: d.email,
    fields: { Name: d.name, Email: d.email, Phone: d.phone, Service: d.service, Message: d.message },
  }));
}

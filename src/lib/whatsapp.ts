// WhatsApp messages for meeting requests, sent through the WhatsApp Cloud API (Meta).
// Configure WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID to send automatically. Without them,
// nothing is sent and the system offers a one-tap wa.me link with the message prefilled.

/** Digits-only international number; local Lebanese numbers (e.g. 71 364 090) get 961. */
export function normalizePhone(raw: string, defaultCountry = "961") {
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith(defaultCountry) && digits.length > 8) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return defaultCountry + digits;
}

export const waLink = (phone: string, text: string) => `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;

export const whatsappConfigured = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

/** The manager's WhatsApp number that receives new meeting requests. */
export const managerWhatsApp = () => process.env.MEETINGS_WHATSAPP_TO?.trim() || "+96171364090";

type Message = {
  to: string;
  /** Approved template name. Business-initiated messages need one; without it plain text is sent (only delivered inside a 24h chat window). */
  template?: string;
  params: string[];
  text: string;
};

export async function sendWhatsApp({ to, template, params, text }: Message): Promise<boolean> {
  if (!whatsappConfigured()) return false;
  const recipient = normalizePhone(to);
  const body = template
    ? {
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
          components: [{ type: "body", parameters: params.map((value) => ({ type: "text", text: value })) }],
        },
      }
    : { messaging_product: "whatsapp", to: recipient, type: "text", text: { body: text, preview_url: false } };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("WhatsApp send failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("WhatsApp send failed", error);
    return false;
  }
}

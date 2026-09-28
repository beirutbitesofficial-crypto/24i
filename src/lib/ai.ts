// GPT-powered script writer for the Scripts page. Uses the OpenAI Chat Completions API
// directly (no SDK) with OPENAI_API_KEY; OPENAI_MODEL optionally overrides the model.

export const aiConfigured = () => Boolean(process.env.OPENAI_API_KEY?.trim());

export class AiError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

const LANGUAGES: Record<string, string> = {
  LEBANESE: "Lebanese Arabic dialect written in Arabic script, natural and conversational like Lebanese social media creators",
  ARABIZI: "Lebanese Arabic dialect written in Arabizi (Latin letters and numbers like 3, 7, 2)",
  ENGLISH: "English",
  MIXED: "a natural Lebanese mix of Arabic and English, as Lebanese creators speak",
};

export type ScriptRequest = {
  mode: "write" | "improve";
  idea: string;
  format: "REEL" | "POST" | "STORY";
  seconds: number;
  language: keyof typeof LANGUAGES | string;
  tone?: string;
  current?: string;
  brand: { brandName: string; industry?: string | null; instagram?: string | null; notes?: string | null };
};

function prompt(r: ScriptRequest) {
  const system = [
    "You are a senior social media scriptwriter at a Lebanese creative agency.",
    "You write short, punchy scripts that are ready to read out loud on a teleprompter.",
    "Rules:",
    "- Start with a strong hook in the first 2 seconds.",
    "- Short lines, one idea per line, easy to read out loud.",
    "- Put camera/visual directions in [square brackets] on their own line.",
    "- End with a clear call to action.",
    "- No hashtags, no emojis inside the spoken lines, no markdown headings or bold.",
    "- Reply with the title on the first line prefixed by 'TITLE: ', then a blank line, then the script only.",
  ].join("\n");

  const brand = [
    `Brand: ${r.brand.brandName}`,
    r.brand.industry && `Industry: ${r.brand.industry}`,
    r.brand.instagram && `Instagram: ${r.brand.instagram}`,
    r.brand.notes && `Notes about the brand: ${r.brand.notes.slice(0, 800)}`,
  ].filter(Boolean).join("\n");

  const format = r.format === "REEL" ? `an Instagram/TikTok reel of about ${r.seconds} seconds` : r.format === "STORY" ? "a sequence of Instagram stories" : "a talking-head video for a feed post";
  const task = r.mode === "improve"
    ? `Improve this script for ${format}. Keep the idea and facts, make it tighter and more engaging.\n\nCurrent script:\n${r.current}\n\nWhat to change: ${r.idea || "make it better"}`
    : `Write a script for ${format}.\n\nIdea / brief: ${r.idea}`;

  const user = `${brand}\n\nLanguage: ${LANGUAGES[r.language] || LANGUAGES.LEBANESE}\n${r.tone ? `Tone: ${r.tone}\n` : ""}\n${task}`;
  return { system, user };
}

export async function generateScript(r: ScriptRequest) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new AiError("AI is not set up yet. Add OPENAI_API_KEY in the hosting environment variables.", 503);
  if (!/^[\x21-\x7e]+$/.test(key)) throw new AiError("OPENAI_API_KEY contains invalid characters. Copy the key again from platform.openai.com.", 503);

  const { system, user } = prompt(r);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  let res: Response;
  try {
    const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.8,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });
  } catch {
    throw new AiError("The AI took too long to answer. Try again.", 504);
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message: string = data?.error?.message || "";
    if (res.status === 401) throw new AiError("The OpenAI key was rejected. Check OPENAI_API_KEY.", 503);
    if (res.status === 429) throw new AiError(/quota|billing/i.test(message) ? "The OpenAI account has no credit left. Add credit at platform.openai.com/settings/organization/billing." : "Too many AI requests right now. Wait a moment and try again.", 429);
    if (res.status === 404) throw new AiError("The AI model in OPENAI_MODEL was not found.", 503);
    console.error("OpenAI error", res.status, message);
    throw new AiError("The AI could not write the script. Try again.");
  }

  const text: string = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!text) throw new AiError("The AI returned an empty answer. Try again.");
  const match = text.match(/^\s*TITLE:\s*(.+)\n+([\s\S]*)$/i);
  return match ? { title: match[1].trim().slice(0, 200), body: match[2].trim() } : { title: "", body: text };
}

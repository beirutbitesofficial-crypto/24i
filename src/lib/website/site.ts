const env = (value: string | undefined) => (value ?? "").trim();

export const site = {
  name: "24i Production",
  url: env(process.env.NEXT_PUBLIC_SITE_URL) || "http://localhost:3000",
  email: env(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
  phone: env(process.env.NEXT_PUBLIC_CONTACT_PHONE),
  whatsapp: env(process.env.NEXT_PUBLIC_WHATSAPP),
  instagram: env(process.env.NEXT_PUBLIC_INSTAGRAM),
  address: env(process.env.NEXT_PUBLIC_ADDRESS) || "Beirut, Lebanon",
  mapQuery: env(process.env.NEXT_PUBLIC_MAP_QUERY) || "Beirut, Lebanon",
  bookingUrl: env(process.env.NEXT_PUBLIC_BOOKING_URL),
  timezone: "Asia/Beirut",
};

/** The site lives at /website inside the main app; its API routes sit under it. */
export const basePath = "/website";

export const nav = [
  { label: "Home", href: "#home" },
  { label: "Services", href: "#services" },
  { label: "Location", href: "#location" },
  { label: "Contact", href: "#contact" },
  { label: "Book a Meeting", href: "#book" },
] as const;

export const services = [
  {
    id: "production",
    title: "Production",
    tagline: "Cinema-grade stories, built for every screen.",
    body: "Concept, crew, cameras and post under one roof. Brand films, commercials and content shot with intent and finished frame by frame.",
  },
  {
    id: "social",
    title: "Social Media Management",
    tagline: "Always on. Always on brand.",
    body: "Strategy, calendars, content and community run as one daily rhythm, so your feed grows audiences instead of just filling space.",
  },
  {
    id: "websites",
    title: "Websites",
    tagline: "Your flagship, online.",
    body: "Fast, art-directed websites engineered to convert. Designed in motion, built on modern frameworks, and easy for your team to run.",
  },
  {
    id: "apps",
    title: "Apps",
    tagline: "Products people keep in their pocket.",
    body: "iOS, Android and web apps, from first prototype to store launch, with interfaces that feel effortless and code that scales.",
  },
  {
    id: "systems",
    title: "Systems",
    tagline: "The engine behind the brand.",
    body: "Custom dashboards, CRMs, automations and internal tools that connect your operations and give your team time back.",
  },
  {
    id: "ads",
    title: "Ads Management",
    tagline: "Spend that answers for itself.",
    body: "Performance campaigns across Meta, Google and TikTok, with creative testing, precise targeting and reporting you can act on.",
  },
] as const;

export type ServiceId = (typeof services)[number]["id"];

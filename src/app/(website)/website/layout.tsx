import type { Metadata, Viewport } from "next";
import "./globals.css";
import { site } from "@/lib/website/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: "24i Production | Production, Social, Websites, Apps, Systems & Ads",
  icons: { icon: "/icon.svg" },
  description:
    "24i Production is a Beirut creative and technology studio: film production, social media management, websites, apps, business systems and ads management.",
  openGraph: {
    title: "24i Production",
    description: "Production, social media, websites, apps, systems and ads, framed through one lens.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#050607", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

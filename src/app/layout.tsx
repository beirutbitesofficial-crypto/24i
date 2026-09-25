import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";

const inter = Inter({ subsets: ["latin"], variable: "--font-latin", display: "swap" });
const arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-arabic", display: "swap" });

export const metadata: Metadata = {
  title: { default: "24i Production", template: "%s · 24i Production" },
  description: "Agency operating system",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f7f8" }, { media: "(prefers-color-scheme: dark)", color: "#0e1213" }],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${inter.variable} ${arabic.variable}`}><body>{children}<PwaRegister /></body></html>;
}

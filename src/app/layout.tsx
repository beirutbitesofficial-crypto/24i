import "./globals.css";
import "./workflow.css";
import "./nav-ux.css";
import "./monthly-planner.css";
import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";

const inter = Inter({ subsets: ["latin"], variable: "--font-latin", display: "swap" });
const arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-arabic", display: "swap" });

const appleIcon = "/api/app-icon?v=full-logo-mac-2";
const desktop192 = "/api/app-icon-desktop?size=192&v=2";
const desktop512 = "/api/app-icon-desktop?size=512&v=2";
// Applies the saved (or system) theme before first paint to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var s=localStorage.getItem('24i-theme');var t=s||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){}})();`;

export const metadata: Metadata = {
  title: { default: "24i Production", template: "%s · 24i Production" },
  description: "Agency operating system",
  applicationName: "24i Production",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: desktop192, sizes: "192x192", type: "image/png" },
      { url: desktop512, sizes: "512x512", type: "image/png" },
    ],
    shortcut: desktop192,
    apple: [{ url: appleIcon, sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "24i Production", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f7f8" }, { media: "(prefers-color-scheme: dark)", color: "#0e1213" }],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${inter.variable} ${arabic.variable}`} suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body>{children}<PwaRegister /></body>
  </html>;
}

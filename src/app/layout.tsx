import "./styles.css";
import "./theme.css";
import "./management.css";
import "./workflow.css";
import "./nav-ux.css";
import "./monthly-planner.css";
import { PwaRegister } from "@/components/pwa-register";

const appleIcon = "/api/app-icon?v=full-logo-mac-2";
const desktop192 = "/api/app-icon-desktop?size=192&v=2";
const desktop512 = "/api/app-icon-desktop?size=512&v=2";
const themeScript = `(function(){try{var s=localStorage.getItem('24i-theme');var t=s||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){}})();`;

export const metadata = {
  title: "24i Production",
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
  appleWebApp: { capable: true, title: "24i Production", statusBarStyle: "black-translucent" as const },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body>{children}<PwaRegister /></body>
  </html>;
}

import "./styles.css";
import "./theme.css";
import "./management.css";
import "./workflow.css";
import { PwaRegister } from "@/components/pwa-register";

const appIcon = "/api/app-icon?v=full-logo-1";
const themeScript = `(function(){try{var s=localStorage.getItem('24i-theme');var t=s||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){}})();`;

export const metadata = {
  title: "24i Production",
  description: "Agency operating system",
  applicationName: "24i Production",
  manifest: "/manifest.webmanifest",
  icons: { icon: appIcon, apple: appIcon },
  appleWebApp: { capable: true, title: "24i Production", statusBarStyle: "black-translucent" as const },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body>{children}<PwaRegister /></body>
  </html>;
}

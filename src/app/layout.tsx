import "./styles.css";
import "./theme.css";
import "./management.css";
import "./workflow.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata = {
  title: "24i Production",
  description: "Agency operating system",
  applicationName: "24i Production",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/api/app-icon", apple: "/api/app-icon" },
  appleWebApp: { capable: true, title: "24i Production", statusBarStyle: "black-translucent" as const },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}<PwaRegister /></body></html>;
}

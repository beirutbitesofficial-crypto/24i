"use client";

import { usePathname } from "next/navigation";

export function RouteMotion({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div key={pathname} className="route-motion">{children}</div>;
}

"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui";

type Theme = "light" | "dark";

export function ThemeToggle({ ar = false }: { ar?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("24i-theme", next); } catch { /* storage unavailable: theme still applies for this visit */ }
  }

  const dark = theme === "dark";
  const label = ar ? (dark ? "المظهر الفاتح" : "المظهر الداكن") : (dark ? "Switch to light mode" : "Switch to dark mode");
  return <button type="button" className="secondary pill icon-pill" onClick={toggle} aria-label={label} title={label}>
    <Icon name={dark ? "sun" : "moon"} size={16} />
  </button>;
}

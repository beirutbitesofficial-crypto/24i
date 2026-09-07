"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle({ ar = false }: { ar?: boolean }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("24i-theme", next);
  }

  const dark = theme === "dark";
  return <button type="button" className="preference-button" onClick={toggle} aria-label={ar ? "تغيير المظهر" : "Change appearance"}>
    <span aria-hidden="true">{dark ? "☀️" : "🌙"}</span>
    <span>{ar ? (dark ? "فاتح" : "داكن") : (dark ? "Light" : "Dark")}</span>
  </button>;
}

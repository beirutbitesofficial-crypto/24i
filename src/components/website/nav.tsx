"use client";

import { useEffect, useState } from "react";
import { nav } from "@/lib/website/site";
import { scrollToSection } from "@/lib/website/scroll";

export function Nav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    scrollToSection(href);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="flex items-center justify-between px-5 py-4 text-white mix-blend-difference sm:px-8 md:px-12 md:py-6">
        <a href="#home" onClick={go("#home")} className="font-wide text-xl tracking-tight" aria-label="24i Production, home">
          24i<span className="ml-2 hidden font-mono text-[10px] font-normal uppercase tracking-[0.4em] [font-stretch:100%] sm:inline">Production</span>
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {nav.slice(0, 4).map((l) => (
            <a key={l.href} href={l.href} onClick={go(l.href)} className="font-mono text-[11px] uppercase tracking-[0.3em] opacity-80 transition hover:opacity-100">
              {l.label}
            </a>
          ))}
          <a href="#book" onClick={go("#book")} className="rounded-full border border-white px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.3em] transition hover:bg-white hover:text-black">
            Book a Meeting
          </a>
        </nav>
        <button
          type="button"
          className="relative h-10 w-10 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`absolute left-2 right-2 top-[15px] h-px bg-white transition ${open ? "translate-y-[5px] rotate-45" : ""}`} />
          <span className={`absolute left-2 right-2 top-[25px] h-px bg-white transition ${open ? "-translate-y-[5px] -rotate-45" : ""}`} />
        </button>
      </div>

      <div
        id="mobile-menu"
        hidden={!open}
        className="fixed inset-0 -z-10 flex flex-col justify-end bg-ink/95 px-6 pb-12 pt-24 backdrop-blur-md md:hidden"
      >
        <nav aria-label="Mobile" className="flex flex-col gap-2">
          {nav.map((l, i) => (
            <a key={l.href} href={l.href} onClick={go(l.href)} className="font-wide flex items-baseline gap-4 border-b border-cream/10 py-3 text-3xl uppercase text-cream">
              <span className="font-mono text-xs text-teal-bright">{String(i + 1).padStart(2, "0")}</span>
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

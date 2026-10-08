"use client";

import { scrollToSection } from "@/lib/website/scroll";

export function SkipIntro() {
  return (
    <button
      type="button"
      data-skip
      onClick={() => scrollToSection("#services")}
      className="absolute bottom-6 right-5 z-20 rounded-full border border-cream/20 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-cream/70 transition hover:border-teal-bright hover:text-cream sm:right-8"
    >
      Skip intro
    </button>
  );
}

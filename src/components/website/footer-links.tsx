"use client";

import { scrollToSection } from "@/lib/website/scroll";

export function FooterLinks({ links }: { links: readonly { label: string; href: string }[] }) {
  return (
    <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3">
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          onClick={(e) => {
            e.preventDefault();
            scrollToSection(l.href);
          }}
          className="font-mono text-[11px] uppercase tracking-[0.3em] text-cream/70 transition hover:text-teal-bright"
        >
          {l.label}
        </a>
      ))}
    </nav>
  );
}

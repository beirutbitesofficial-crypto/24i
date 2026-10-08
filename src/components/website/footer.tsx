import { nav, site } from "@/lib/website/site";
import { FooterLinks } from "./footer-links";

export function Footer() {
  return (
    <footer className="bg-ink px-6 pb-8 pt-20 sm:px-10 md:px-16">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col gap-10 border-b border-cream/10 pb-10 md:flex-row md:items-end md:justify-between">
          <p className="font-wide text-[clamp(4rem,16vw,14rem)] leading-[0.8]">
            24i<span className="text-teal-bright">.</span>
          </p>
          <FooterLinks links={nav} />
        </div>
        <div className="flex flex-col gap-3 pt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-mute sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} {site.name}</span>
          <span>{site.address}</span>
        </div>
      </div>
    </footer>
  );
}

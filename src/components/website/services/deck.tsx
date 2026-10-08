import type { ReactNode } from "react";
import { services, type ServiceId } from "@/lib/website/site";
import { AdsVisual, AppsVisual, ProductionVisual, SocialVisual, SystemsVisual, WebsitesVisual } from "./visuals";
import { DeckControls } from "./deck-controls";

type Look = {
  visual: ReactNode;
  surface: string;
  accent: string;
  /** Title lines; each line is revealed through its own mask. */
  lines: string[];
  titleSize: string;
  layout: string;
};

const LOOKS: Record<ServiceId, Look> = {
  production: {
    visual: <ProductionVisual />,
    surface: "bg-ink text-cream",
    accent: "text-teal-bright",
    lines: ["Production"],
    titleSize: "text-[clamp(1.9rem,9.6vw,12rem)]",
    layout: "items-end",
  },
  social: {
    visual: <SocialVisual />,
    surface: "bg-[#031615] text-cream",
    accent: "text-teal-bright",
    lines: ["Social", "Media", "Management"],
    titleSize: "text-[clamp(1.9rem,8.6vw,9.5rem)]",
    layout: "items-center",
  },
  websites: {
    visual: <WebsitesVisual />,
    surface: "bg-cream text-ink",
    accent: "text-teal",
    lines: ["Web", "sites"],
    titleSize: "text-[clamp(3.4rem,15vw,15rem)]",
    layout: "items-end",
  },
  apps: {
    visual: <AppsVisual />,
    surface: "bg-ink-soft text-cream",
    accent: "text-teal-bright",
    lines: ["Apps"],
    titleSize: "text-[clamp(5rem,24vw,24rem)]",
    layout: "items-center",
  },
  systems: {
    visual: <SystemsVisual />,
    surface: "bg-[#070b0c] text-cream",
    accent: "text-teal-bright",
    lines: ["Sys", "tems"],
    titleSize: "text-[clamp(3.4rem,14vw,14rem)]",
    layout: "items-start",
  },
  ads: {
    visual: <AdsVisual />,
    surface: "bg-teal text-ink",
    accent: "text-cream",
    lines: ["Ads", "Management"],
    titleSize: "text-[clamp(1.9rem,8.6vw,10rem)]",
    layout: "items-end",
  },
};

const TOTAL = String(services.length).padStart(2, "0");

/** Services presentation markup. Paging and transitions live in the Cinema controller (cinema.tsx). */
export function ServicesDeck() {
  return (
    <section id="services" aria-labelledby="services-title" className="deck relative z-0 bg-ink">
      <h2 id="services-title" className="sr-only">Services</h2>
      <div className="deck-stage [perspective:1600px]">
        {services.map((s, i) => {
          const look = LOOKS[s.id];
          const n = String(i + 1).padStart(2, "0");
          return (
            <article
              key={s.id}
              data-slide
              aria-roledescription="slide"
              aria-label={`${n} of ${TOTAL}: ${s.title}`}
              className={`slide relative h-[100svh] min-h-[560px] overflow-hidden will-change-transform ${look.surface}`}
            >
              {look.visual}
              <div className={`relative z-10 flex h-full ${look.layout} px-6 pb-24 pt-24 sm:px-10 md:px-16 md:pb-28`}>
                <div className="w-full">
                  <p data-s="meta" className={`font-mono text-xs uppercase tracking-[0.4em] ${look.accent}`}>
                    {n} <span className="opacity-50">/ {TOTAL}</span>
                  </p>
                  <h3 className={`font-wide mt-3 uppercase leading-[0.84] ${look.titleSize}`}>
                    {look.lines.map((line) => (
                      <span key={line} className="mask block">
                        <span data-s="word">{line}</span>
                      </span>
                    ))}
                  </h3>
                  <div className="mt-6 grid max-w-3xl gap-3 md:mt-8 md:grid-cols-[1.1fr_1fr] md:gap-10">
                    <p data-s="meta" className="font-wide text-xl uppercase leading-tight tracking-normal [font-stretch:110%] md:text-2xl">
                      {s.tagline}
                    </p>
                    <p data-s="meta" className="text-sm leading-relaxed opacity-75 md:text-base">
                      {s.body}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}

        <svg className="deck-live-only pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true">
          <polygon data-hex-ring fill="none" stroke="#19c2bd" strokeWidth="2" />
        </svg>

        <DeckControls total={services.length} />
      </div>
    </section>
  );
}

"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { services, type ServiceId } from "@/lib/website/site";
import { registerScrollTarget } from "@/lib/website/scroll";
import { AdsVisual, AppsVisual, ProductionVisual, SocialVisual, SystemsVisual, WebsitesVisual } from "./visuals";

gsap.registerPlugin(ScrollTrigger, useGSAP);

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

const hexagon = (r: number, angle: number, cx: number, cy: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = angle + (Math.PI / 3) * i;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r].map((v) => v.toFixed(1));
  });

export function ServicesDeck() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const stageEl = stage.current!;
      const q = gsap.utils.selector(el);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        el.classList.add("is-live");
        const slides = q("[data-slide]") as HTMLElement[];
        const within = (i: number, sel: string) => slides[i].querySelectorAll(sel);
        const counter = q("[data-counter]")[0] as HTMLElement;
        const fills = q("[data-fill]") as HTMLElement[];
        const hexRing = q("[data-hex-ring]")[0] as unknown as SVGPolygonElement;

        gsap.set(slides.slice(1), { autoAlpha: 0 });

        const tl = gsap.timeline({
          defaults: { ease: "power3.inOut" },
          scrollTrigger: {
            trigger: stageEl,
            start: "top top",
            end: () => `+=${window.innerHeight * 6.4}`,
            pin: true,
            scrub: 0.9,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        const reveal = (i: number, at: number) => {
          tl.fromTo(within(i, "[data-s=word]"), { yPercent: 112 }, { yPercent: 0, duration: 0.7, stagger: 0.09, ease: "power4.out" }, at)
            .fromTo(within(i, "[data-s=meta]"), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08, ease: "power3.out" }, at + 0.2);
        };
        const enter = (i: number, at: number) => tl.set(slides[i], { autoAlpha: 1 }, at);
        const starts: number[] = [];

        // 01 Production: the camera aperture opens onto the first slide.
        const aperture = { r: 16, a: 0 };
        const drawAperture = () => {
          const w = stageEl.clientWidth;
          const h = stageEl.clientHeight;
          const pts = hexagon(aperture.r, aperture.a, w / 2, h / 2);
          slides[0].style.clipPath = `polygon(${pts.map(([x, y]) => `${x}px ${y}px`).join(", ")})`;
          hexRing.setAttribute("points", pts.map(([x, y]) => `${x},${y}`).join(" "));
        };
        starts.push(0);
        tl.fromTo(
          aperture,
          { r: 16, a: 0 },
          {
            r: () => (Math.hypot(window.innerWidth, window.innerHeight) / 2 / Math.cos(Math.PI / 6)) * 1.08,
            a: Math.PI / 2,
            duration: 1.3,
            ease: "power2.inOut",
            onUpdate: drawAperture,
            onComplete: () => slides[0].style.removeProperty("clip-path"),
            onReverseComplete: drawAperture,
          },
          0,
        )
          .fromTo(q("[data-hex-ring]"), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.5, ease: "none" }, 0.7)
          .fromTo(within(0, '[data-v="flare"]'), { scaleX: 0.15 }, { scaleX: 1, duration: 1.3 }, 0)
          .fromTo(within(0, '[data-v="bar-top"], [data-v="bar-bottom"]'), { scaleY: 3.5 }, { scaleY: 1, duration: 1.3, transformOrigin: (_i: number, t: Element) => ((t as HTMLElement).dataset.v === "bar-top" ? "50% 0%" : "50% 100%") }, 0.15)
          .fromTo(within(0, '[data-v="strip"]'), { yPercent: -8 }, { yPercent: 12, duration: 3.6, ease: "none" }, 0)
          .fromTo(within(0, '[data-v="beam"]'), { rotation: 30, autoAlpha: 0 }, { rotation: 14, autoAlpha: 1, duration: 2.4, ease: "power1.inOut" }, 0.4);
        reveal(0, 1.0);

        // 02 Social: vertical wipe, the feed starts scrolling.
        let t = 3.0;
        starts.push(t);
        enter(1, t);
        tl.fromTo(slides[1], { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1 }, t)
          .to(slides[0].children, { yPercent: -18, duration: 1 }, t)
          .fromTo(within(1, '[data-v="phone"]'), { y: () => window.innerHeight * 0.6 }, { y: 0, duration: 1.2, stagger: 0.12, ease: "power3.out" }, t + 0.2)
          .fromTo(within(1, '[data-v="feed"]'), { yPercent: 0 }, { yPercent: -38, duration: 2.6, ease: "none" }, t + 0.2);
        tl.set(slides[0], { autoAlpha: 0 }, t + 1);
        reveal(1, t + 0.7);

        // 03 Websites: perspective shift, the page assembles itself.
        t = 6.0;
        starts.push(t);
        enter(2, t);
        tl.to(slides[1], { rotationX: 14, scale: 0.86, yPercent: -10, autoAlpha: 0.2, transformOrigin: "50% 100%", duration: 1.1 }, t)
          .fromTo(slides[2], { yPercent: 100, rotationX: -22, transformOrigin: "50% 0%" }, { yPercent: 0, rotationX: 0, duration: 1.1 }, t)
          .fromTo(within(2, '[data-v="block"]'), { autoAlpha: 0, y: 40, z: 120 }, { autoAlpha: 1, y: 0, z: 0, duration: 0.6, stagger: 0.14, ease: "power3.out" }, t + 0.8)
          .fromTo(within(2, '[data-v="browser"]'), { rotationY: -34, rotationX: 26 }, { rotationY: -16, rotationX: 12, duration: 2.6, ease: "power1.inOut" }, t + 0.3)
          .fromTo(within(2, '[data-v="cursor"]'), { x: 120, y: 80, autoAlpha: 0 }, { x: 0, y: 0, autoAlpha: 1, duration: 1, ease: "power2.out" }, t + 1.4);
        tl.set(slides[1], { autoAlpha: 0 }, t + 1.1);
        reveal(2, t + 0.75);

        // 04 Apps: diagonal wipe, screens flow through the device.
        t = 9.0;
        starts.push(t);
        enter(3, t);
        tl.fromTo(
          slides[3],
          { clipPath: "polygon(100% 0%, 135% 0%, 135% 100%, 118% 100%)" },
          { clipPath: "polygon(-35% 0%, 135% 0%, 135% 100%, -18% 100%)", duration: 1.1 },
          t,
        )
          .to(slides[2], { xPercent: -12, duration: 1.1 }, t)
          .fromTo(within(3, '[data-v="device"]'), { yPercent: 30, rotation: 8, autoAlpha: 0 }, { yPercent: 0, rotation: 0, autoAlpha: 1, duration: 1, ease: "power3.out" }, t + 0.4)
          .fromTo(within(3, '[data-v="screens"]'), { yPercent: 0 }, { yPercent: -66.666, duration: 2.2, ease: "power2.inOut" }, t + 0.9)
          .fromTo(within(3, '[data-v="orbit"]'), { rotation: -40, scale: 0.7, autoAlpha: 0 }, { rotation: 50, scale: 1, autoAlpha: 1, duration: 2.8, ease: "power1.out" }, t + 0.2);
        tl.set(slides[2], { autoAlpha: 0 }, t + 1.1);
        reveal(3, t + 0.7);

        // 05 Systems: centre split, the network wires itself up.
        t = 12.0;
        starts.push(t);
        enter(4, t);
        tl.fromTo(slides[4], { clipPath: "inset(0% 50% 0% 50%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1 }, t)
          .to(slides[3], { scale: 0.9, autoAlpha: 0.3, duration: 1 }, t)
          .fromTo(within(4, '[data-v="node"]'), { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4, stagger: 0.07, ease: "back.out(2)" }, t + 0.5)
          .fromTo(within(4, '[data-v="edge"]'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, stagger: 0.08, ease: "power2.out" }, t + 0.8);
        tl.set(slides[3], { autoAlpha: 0 }, t + 1);
        reveal(4, t + 0.7);

        // 06 Ads: push through, the numbers climb.
        t = 15.0;
        starts.push(t);
        enter(5, t);
        tl.to(slides[4], { scale: 1.3, autoAlpha: 0, duration: 1, ease: "power2.in" }, t)
          .fromTo(slides[5], { clipPath: "inset(32% 32% 32% 32% round 48px)", scale: 1.2 }, { clipPath: "inset(0% 0% 0% 0% round 0px)", scale: 1, duration: 1.1 }, t + 0.1)
          .fromTo(within(5, '[data-v="target"]'), { scale: 0.5, rotation: -30 }, { scale: 1, rotation: 0, duration: 1.8, ease: "power2.out" }, t + 0.3)
          .fromTo(within(5, '[data-v="bar"]'), { scaleY: 0 }, { scaleY: 1, duration: 0.6, stagger: 0.07, ease: "power3.out" }, t + 0.8)
          .fromTo(within(5, '[data-v="curve"]'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2, ease: "power2.inOut" }, t + 1);
        reveal(5, t + 0.8);
        tl.to({}, { duration: 1 }, t + 2.2);

        // Presentation HUD: live counter and progress segments.
        const ends = [...starts.slice(1), tl.duration()];
        let current = -1;
        tl.eventCallback("onUpdate", () => {
          const now = tl.time();
          let idx = 0;
          starts.forEach((s, i) => {
            if (now >= s + 0.5) idx = i;
          });
          if (idx !== current) {
            current = idx;
            counter.textContent = String(idx + 1).padStart(2, "0");
          }
          fills.forEach((f, i) => {
            f.style.transform = `scaleX(${gsap.utils.clamp(0, 1, (now - starts[i]) / (ends[i] - starts[i]))})`;
          });
        });

        drawAperture();
        const unregister = registerScrollTarget("services", () => {
          // Land just after the aperture has opened onto slide 01.
          const st = tl.scrollTrigger!;
          return Math.round(st.start + (st.end - st.start) * (1.5 / tl.duration()));
        });

        return () => {
          unregister();
          el.classList.remove("is-live");
          slides[0].style.removeProperty("clip-path");
        };
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="services" aria-labelledby="services-title" className="deck relative z-0 bg-ink">
      <h2 id="services-title" className="sr-only">Services</h2>
      <div ref={stage} className="deck-stage [perspective:1600px]">
        {services.map((s, i) => {
          const look = LOOKS[s.id];
          const n = String(i + 1).padStart(2, "0");
          return (
            <article
              key={s.id}
              data-slide
              aria-roledescription="slide"
              aria-label={`${n} of ${TOTAL}: ${s.title}`}
              className={`slide grain relative h-[100svh] min-h-[560px] overflow-hidden will-change-transform ${look.surface}`}
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

        <div className="deck-live-only pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-6 px-6 pb-6 font-mono text-[10px] uppercase tracking-[0.35em] text-white mix-blend-difference sm:px-10 md:px-16 md:pb-8 md:text-xs">
          <span className="hidden sm:inline"><span className="normal-case">24i</span> · Services</span>
          <div className="flex flex-1 items-center gap-1.5 sm:max-w-sm" aria-hidden="true">
            {services.map((s) => (
              <span key={s.id} className="relative h-[2px] flex-1 overflow-hidden bg-white/25">
                <span data-fill className="absolute inset-0 origin-left scale-x-0 bg-white" />
              </span>
            ))}
          </div>
          <span>
            <span data-counter>01</span> / {TOTAL}
          </span>
        </div>
      </div>
    </section>
  );
}

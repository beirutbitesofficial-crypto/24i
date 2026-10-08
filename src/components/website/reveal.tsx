"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Scroll-in reveal for regular sections: masked lines rise, [data-r] items fade up, [data-r-wipe] opens. */
export function Reveal({ children, className, as: Tag = "div", ...rest }: { children: ReactNode; className?: string; as?: "div" | "section" | "footer" } & Record<string, unknown>) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(ref);
        const tl = gsap.timeline({ scrollTrigger: { trigger: ref.current, start: "top 78%", once: true } });
        tl.from(q("[data-r-line]"), { yPercent: 110, duration: 1.1, stagger: 0.08, ease: "power4.out" })
          .from(q("[data-r-wipe]"), { clipPath: "inset(0% 0% 100% 0%)", duration: 1.3, ease: "power3.inOut" }, 0.1)
          .from(q("[data-r]"), { autoAlpha: 0, y: 30, duration: 0.9, stagger: 0.06, ease: "power3.out" }, 0.25);
      });
      return () => mm.revert();
    },
    { scope: ref },
  );
  const Component = Tag as "div";
  return (
    <Component ref={ref as React.Ref<HTMLDivElement>} className={className} {...rest}>
      {children}
    </Component>
  );
}

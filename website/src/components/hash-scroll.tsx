"use client";

import { useEffect } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollToSection } from "@/lib/scroll";

/** Pinned sections shift layout after hydration, so honour an initial #hash once ScrollTrigger has measured. */
export function HashScroll() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash === "#home") return;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const go = () => scrollToSection(hash);
    const id = window.setTimeout(() => {
      ScrollTrigger.refresh();
      go();
    }, 120);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}

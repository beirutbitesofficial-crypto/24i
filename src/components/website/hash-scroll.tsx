"use client";

import { useEffect } from "react";
import { scrollToSection } from "@/lib/website/scroll";

/** Honour an initial #hash for sections below the cinema once the layout has settled. */
export function HashScroll() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash === "#home" || hash === "#services") return;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const id = window.setTimeout(() => scrollToSection(hash), 150);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}

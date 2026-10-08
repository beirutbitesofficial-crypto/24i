"use client";

/**
 * Pinned GSAP sections move their DOM into pin spacers, so plain anchor jumps
 * land in the wrong place. Animated sections register the exact scroll offset
 * for their anchor here; navigation falls back to the element otherwise.
 */
const targets = new Map<string, () => number>();

export function registerScrollTarget(id: string, resolve: () => number) {
  targets.set(id, resolve);
  return () => {
    if (targets.get(id) === resolve) targets.delete(id);
  };
}

export function scrollToSection(hash: string) {
  const id = hash.replace(/^#/, "");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
  const resolve = targets.get(id);
  if (id === "home") {
    window.scrollTo({ top: 0, behavior });
  } else if (resolve) {
    window.scrollTo({ top: resolve(), behavior });
  } else {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior });
  }
  history.replaceState(null, "", `#${id}`);
}

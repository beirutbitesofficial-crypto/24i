"use client";

/**
 * The intro and services run as a paged "cinema" at the top of the page while the
 * rest of the site scrolls normally. The cinema controller registers itself here so
 * navigation can either turn its pages or hand control back to native scrolling.
 */
export type PageTarget = number | "next" | "prev";
type Pager = { go: (target: PageTarget) => void; leave: () => void };

let pager: Pager | null = null;

export function registerPager(p: Pager) {
  pager = p;
  return () => {
    if (pager === p) pager = null;
  };
}

/** Page 0 is the intro; pages 1..6 are the services. */
export function goToPage(target: PageTarget) {
  pager?.go(target);
}

export function scrollToSection(hash: string) {
  const id = hash.replace(/^#/, "");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
  history.replaceState(null, "", `#${id}`);

  if (pager && (id === "home" || id === "services")) {
    pager.go(id === "home" ? 0 : 1);
    return;
  }
  if (id === "home") {
    window.scrollTo({ top: 0, behavior });
    return;
  }
  pager?.leave();
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior });
}

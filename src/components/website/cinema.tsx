"use client";

import { useRef } from "react";
import gsap from "gsap";
import { Observer } from "gsap/Observer";
import { useGSAP } from "@gsap/react";
import { Intro } from "./intro/intro";
import { LID } from "./intro/eye";
import { CAMERA_GLASS_RATIO } from "./intro/camera";
import { ServicesDeck } from "./services/deck";
import { registerPager, type PageTarget } from "@/lib/website/scroll";

gsap.registerPlugin(Observer, useGSAP);

// Intro timeline (seconds of timeline time, not wall clock).
const EYE_SCALE = 1.18;
const IRIS_RATIO = 132 / 1000;
const FPS = 24;
const REC_START = 5.4;
const CUT = 8.0;
const INTRO_END = 9.0;

// Wall-clock durations for page turns.
const INTRO_PLAY = 7.2;
const INTRO_REWIND = 2.2;
const PAGE_TURN = 1.6;
const INPUT_COOLDOWN = 450;

const pad = (n: number) => String(n).padStart(2, "0");
const timecode = (frames: number) => {
  const f = Math.max(0, Math.floor(frames));
  const s = Math.floor(f / FPS);
  return `01:${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(f % FPS)}`;
};

const hexagon = (r: number, angle: number, cx: number, cy: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = angle + (Math.PI / 3) * i;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r].map((v) => v.toFixed(1));
  });

/**
 * The intro and the services presentation as one paged "cinema" at the top of the page.
 * Page 0 is the eye. One scroll plays the whole intro (blink → lens → camera → REC → cut)
 * and lands on service 01; every further scroll turns exactly one page. Past service 06
 * the page hands back to normal scrolling, and scrolling back to the top re-enters it.
 */
export function Cinema() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const q = gsap.utils.selector(el);
      const one = (selector: string) => q(selector)[0] as HTMLElement;
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        // Static, legible composition: the powered camera, then the services stacked.
        gsap.set(one("[data-eye-wrap]"), { autoAlpha: 0 });
        gsap.set(one(".cam-rig"), { autoAlpha: 1, scale: 0.6 });
        gsap.set(q('[data-cam="leds-on"], [data-cam="screen-on"], [data-cam="tally"]'), { autoAlpha: 1 });
        gsap.set(q("[data-cue], [data-skip]"), { autoAlpha: 0 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        el.classList.add("is-live");
        const intro = one("#home");
        const eyeWrap = one("[data-eye-wrap]");
        const rig = one(".cam-rig");
        const hud = one("[data-rec]");
        const tcEls = q("[data-tc]");
        const upper = one('[data-eye="lid-upper"]');
        const lower = one('[data-eye="lid-lower"]');
        const lashU = one('[data-eye="lash-upper"]');
        const lashL = one('[data-eye="lash-lower"]');
        const lashShadow = one('[data-eye="lash-shadow"]');
        const iris = one('[data-eye="iris"]');
        const stage = one(".deck-stage");
        const slides = q("[data-slide]") as HTMLElement[];
        const within = (i: number, sel: string) => slides[i].querySelectorAll(sel);
        const counter = one("[data-counter]");
        const fills = q("[data-fill]") as HTMLElement[];
        const hexRing = one("[data-hex-ring]");

        /* ---------------- Intro: eye → lens → camera → REC → cut ---------------- */
        const startScale = () => (eyeWrap.offsetWidth * IRIS_RATIO * EYE_SCALE) / (rig.offsetWidth * CAMERA_GLASS_RATIO);
        const diveScale = () => (Math.hypot(window.innerWidth, window.innerHeight) / 2 / (rig.offsetWidth * CAMERA_GLASS_RATIO)) * 1.15;

        gsap.set(rig, { autoAlpha: 0 });
        gsap.set(hud, { autoAlpha: 0 });
        gsap.set(one('[data-eye="pupil"]'), { svgOrigin: "500 280" });
        gsap.set(one('[data-cam="focus-ring"]'), { svgOrigin: "500 350" });
        gsap.set(one('[data-cam="rec-btn"]'), { svgOrigin: "180 208" });

        let lastRec = "";
        const it = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          onUpdate: () => {
            const t = it.time();
            const state = t < REC_START ? "idle" : t < CUT ? "rec" : "cut";
            const code = timecode((Math.min(Math.max(t, REC_START), CUT) - REC_START) * FPS * 2.2);
            tcEls.forEach((n) => {
              if (n.textContent !== code) n.textContent = code;
            });
            if (state !== lastRec) hud.dataset.rec = lastRec = state;
          },
        });

        const lids = (at: number, closed: boolean, duration: number) => {
          const ease = closed ? "power2.in" : "power2.out";
          it.to(upper, { attr: { d: closed ? LID.upperClosed : LID.upperOpen }, duration, ease }, at)
            .to(lower, { attr: { d: closed ? LID.lowerClosed : LID.lowerOpen }, duration, ease }, at)
            .to([lashU, lashShadow], { attr: { d: closed ? LID.upperLashClosed : LID.upperLashOpen }, duration, ease }, at)
            .to(lashL, { attr: { d: closed ? LID.lowerLashClosed : LID.lowerLashOpen }, duration, ease }, at);
        };

        it.to(q("[data-hero]"), { yPercent: -35, autoAlpha: 0, duration: 0.8, ease: "power2.in", stagger: 0.05 }, 0)
          .to(q("[data-cue]"), { autoAlpha: 0, duration: 0.3 }, 0)
          .fromTo(eyeWrap, { scale: 1 }, { scale: EYE_SCALE, duration: 3.2, ease: "power1.inOut" }, 0)
          .fromTo(one('[data-eye="pupil"]'), { scale: 1 }, { scale: 1.32, duration: 0.9 }, 0.2);

        lids(1.1, true, 0.3);
        lids(1.42, false, 0.36);
        lids(2.0, true, 0.38);
        it.set(one('[data-eye="ball"]'), { autoAlpha: 0 }, 2.42)
          .set(one('[data-eye="lens"]'), { autoAlpha: 1 }, 2.42)
          .to(q("[data-glow]"), { opacity: 0.25, duration: 0.6 }, 2.2);
        lids(2.5, false, 0.6);

        it.fromTo(rig, { autoAlpha: 0, scale: startScale, rotationX: 0, rotationY: 0, rotationZ: 0 }, { autoAlpha: 1, duration: 0.25, ease: "none" }, 3.2)
          .to(eyeWrap, { autoAlpha: 0, duration: 0.3, ease: "none" }, 3.25)
          .to(rig, { scale: 1, duration: 1.55, ease: "power3.inOut" }, 3.35)
          .to(rig, { rotationY: -34, rotationX: 10, rotationZ: -4, duration: 0.75 }, 3.35)
          .to(rig, { rotationY: 24, rotationX: 4, rotationZ: 2, duration: 0.75 }, 4.1)
          .to(rig, { rotationY: 0, rotationX: 0, rotationZ: 0, duration: 0.45, ease: "power2.out" }, 4.85)
          .fromTo(one('[data-cam="focus-ring"]'), { rotation: 0 }, { rotation: 240, duration: 1.9, ease: "power1.inOut" }, 3.35)
          .to(q("[data-glow]"), { opacity: 0.6, duration: 0.8 }, 3.6);

        it.to(one('[data-cam="leds-on"]'), { autoAlpha: 1, duration: 0.12, ease: "none" }, 5.0)
          .to(one('[data-cam="screen-on"]'), { autoAlpha: 1, duration: 0.25, ease: "power1.out" }, 5.05)
          .to(one('[data-cam="rec-btn"]'), { scale: 0.74, duration: 0.08, ease: "power1.in" }, REC_START - 0.1)
          .to(one('[data-cam="rec-btn"]'), { scale: 1, duration: 0.14, ease: "back.out(3)" }, REC_START - 0.02)
          .to(q('[data-cam="tally"], [data-cam="rec-btn-glow"]'), { autoAlpha: 1, duration: 0.08, ease: "none" }, REC_START)
          .fromTo(q("[data-cam-rec]"), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: "power2.out" }, REC_START);

        it.to(q("[data-cam-rec]"), { autoAlpha: 0, duration: 0.15 }, 5.75)
          .to(q("[data-skip]"), { autoAlpha: 0, duration: 0.2 }, 5.6)
          .to(rig, { scale: diveScale, duration: 0.85, ease: "power3.in" }, 5.6)
          .to(rig, { autoAlpha: 0, duration: 0.15, ease: "none" }, 6.32)
          .to(hud, { autoAlpha: 1, duration: 0.3, ease: "none" }, 6.3)
          .fromTo(q("[data-vf-frame]"), { scale: 1.12 }, { scale: 1, duration: 0.5, ease: "power3.out" }, 6.3)
          .fromTo(q("[data-vf-scene]"), { scale: 1.1 }, { scale: 1, duration: 1.7, ease: "none" }, 6.3)
          .fromTo(q("[data-vf-line]"), { yPercent: 110 }, { yPercent: 0, duration: 0.45, stagger: 0.1, ease: "power3.out" }, 6.5)
          .fromTo(q("[data-vf-sweep]"), { xPercent: -120 }, { xPercent: 120, duration: 1.3, ease: "power1.inOut" }, 6.6);

        it.fromTo(q("[data-vf-flash]"), { autoAlpha: 0 }, { autoAlpha: 0.85, duration: 0.04, ease: "none" }, CUT)
          .to(q("[data-vf-flash]"), { autoAlpha: 0, duration: 0.22, ease: "power1.out" }, CUT + 0.04)
          .to(q("[data-vf-frame]"), { scale: 1.45, autoAlpha: 0, duration: 0.6, ease: "power3.in" }, CUT + 0.15)
          .to(q("[data-vf-scene]"), { scale: 0.55, autoAlpha: 0, duration: 0.6, ease: "power3.in" }, CUT + 0.15)
          .fromTo(q("[data-hex]"), { scale: 0, autoAlpha: 0, rotation: -60 }, { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.4, ease: "back.out(2)" }, CUT + 0.55)
          .set(intro, { autoAlpha: 0 }, INTRO_END);

        /* ---------------- Services: six pages, each with its own transition ---------------- */
        gsap.set(slides.slice(1), { autoAlpha: 0 });
        const dt = gsap.timeline({ defaults: { ease: "power3.inOut" } });
        const reveal = (i: number, at: number) => {
          dt.fromTo(within(i, "[data-s=word]"), { yPercent: 112 }, { yPercent: 0, duration: 0.7, stagger: 0.09, ease: "power4.out" }, at)
            .fromTo(within(i, "[data-s=meta]"), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.08, ease: "power3.out" }, at + 0.2);
        };
        const enter = (i: number, at: number) => dt.set(slides[i], { autoAlpha: 1 }, at);
        // Where each service page starts, and where it has settled (its resting frame).
        const starts = [0, 3, 6, 9, 12, 15];
        const settled = [1.95, 5.2, 8.2, 11.2, 14.2, 17.2];

        const aperture = { r: 16, a: 0 };
        const drawAperture = () => {
          const pts = hexagon(aperture.r, aperture.a, stage.clientWidth / 2, stage.clientHeight / 2);
          slides[0].style.clipPath = `polygon(${pts.map(([x, y]) => `${x}px ${y}px`).join(", ")})`;
          hexRing.setAttribute("points", pts.map(([x, y]) => `${x},${y}`).join(" "));
        };

        // 01 Production: the camera aperture opens onto the first page.
        dt.fromTo(
          aperture,
          { r: 16, a: 0 },
          {
            r: () => (Math.hypot(window.innerWidth, window.innerHeight) / 2 / Math.cos(Math.PI / 6)) * 1.08,
            a: Math.PI / 2,
            duration: 1.3,
            ease: "power2.inOut",
            onUpdate: drawAperture,
            onComplete: () => slides[0].style.removeProperty("clip-path"),
          },
          0,
        )
          .fromTo(hexRing, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.5, ease: "none" }, 0.7)
          .fromTo(within(0, '[data-v="flare"]'), { scaleX: 0.15 }, { scaleX: 1, duration: 1.3 }, 0)
          .fromTo(within(0, '[data-v="bar-top"], [data-v="bar-bottom"]'), { scaleY: 3.5 }, { scaleY: 1, duration: 1.3, transformOrigin: (_i: number, t: Element) => ((t as HTMLElement).dataset.v === "bar-top" ? "50% 0%" : "50% 100%") }, 0.15)
          .fromTo(within(0, '[data-v="strip"]'), { yPercent: -8 }, { yPercent: 12, duration: 3.6, ease: "none" }, 0)
          .fromTo(within(0, '[data-v="beam"]'), { rotation: 30, autoAlpha: 0 }, { rotation: 14, autoAlpha: 1, duration: 2.4, ease: "power1.inOut" }, 0.4);
        reveal(0, 1.0);

        // 02 Social: vertical wipe, the feed starts scrolling.
        let t = starts[1];
        enter(1, t);
        dt.fromTo(slides[1], { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1 }, t)
          .to(slides[0].children, { yPercent: -18, duration: 1 }, t)
          .fromTo(within(1, '[data-v="phone"]'), { y: () => window.innerHeight * 0.6 }, { y: 0, duration: 1.2, stagger: 0.12, ease: "power3.out" }, t + 0.2)
          .fromTo(within(1, '[data-v="feed"]'), { yPercent: 0 }, { yPercent: -38, duration: 2.6, ease: "none" }, t + 0.2)
          .set(slides[0], { autoAlpha: 0 }, t + 1);
        reveal(1, t + 0.7);

        // 03 Websites: perspective shift, the page assembles itself.
        t = starts[2];
        enter(2, t);
        dt.to(slides[1], { rotationX: 14, scale: 0.86, yPercent: -10, autoAlpha: 0.2, transformOrigin: "50% 100%", duration: 1.1 }, t)
          .fromTo(slides[2], { yPercent: 100, rotationX: -22, transformOrigin: "50% 0%" }, { yPercent: 0, rotationX: 0, duration: 1.1 }, t)
          .fromTo(within(2, '[data-v="block"]'), { autoAlpha: 0, y: 40, z: 120 }, { autoAlpha: 1, y: 0, z: 0, duration: 0.6, stagger: 0.14, ease: "power3.out" }, t + 0.8)
          .fromTo(within(2, '[data-v="browser"]'), { rotationY: -34, rotationX: 26 }, { rotationY: -16, rotationX: 12, duration: 2.2, ease: "power2.out" }, t + 0.3)
          .fromTo(within(2, '[data-v="cursor"]'), { x: 120, y: 80, autoAlpha: 0 }, { x: 0, y: 0, autoAlpha: 1, duration: 0.8, ease: "power2.out" }, t + 1.3)
          .set(slides[1], { autoAlpha: 0 }, t + 1.1);
        reveal(2, t + 0.75);

        // 04 Apps: diagonal wipe, screens flow through the device.
        t = starts[3];
        enter(3, t);
        dt.fromTo(slides[3], { clipPath: "polygon(100% 0%, 135% 0%, 135% 100%, 118% 100%)" }, { clipPath: "polygon(-35% 0%, 135% 0%, 135% 100%, -18% 100%)", duration: 1.1 }, t)
          .to(slides[2], { xPercent: -12, duration: 1.1 }, t)
          .fromTo(within(3, '[data-v="device"]'), { yPercent: 30, rotation: 8, autoAlpha: 0 }, { yPercent: 0, rotation: 0, autoAlpha: 1, duration: 1, ease: "power3.out" }, t + 0.4)
          .fromTo(within(3, '[data-v="screens"]'), { yPercent: 0 }, { yPercent: -66.666, duration: 1.6, ease: "power2.inOut" }, t + 0.6)
          .fromTo(within(3, '[data-v="orbit"]'), { rotation: -40, scale: 0.7, autoAlpha: 0 }, { rotation: 50, scale: 1, autoAlpha: 1, duration: 2.2, ease: "power2.out" }, t)
          .set(slides[2], { autoAlpha: 0 }, t + 1.1);
        reveal(3, t + 0.7);

        // 05 Systems: centre split, the network wires itself up.
        t = starts[4];
        enter(4, t);
        dt.fromTo(slides[4], { clipPath: "inset(0% 50% 0% 50%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1 }, t)
          .to(slides[3], { scale: 0.9, autoAlpha: 0.3, duration: 1 }, t)
          .fromTo(within(4, '[data-v="node"]'), { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4, stagger: 0.06, ease: "back.out(2)" }, t + 0.5)
          .fromTo(within(4, '[data-v="edge"]'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, stagger: 0.06, ease: "power2.out" }, t + 0.7)
          .set(slides[3], { autoAlpha: 0 }, t + 1);
        reveal(4, t + 0.7);

        // 06 Ads: push through, the numbers climb.
        t = starts[5];
        enter(5, t);
        dt.to(slides[4], { scale: 1.3, autoAlpha: 0, duration: 1, ease: "power2.in" }, t)
          .fromTo(slides[5], { clipPath: "inset(32% 32% 32% 32% round 48px)", scale: 1.2 }, { clipPath: "inset(0% 0% 0% 0% round 0px)", scale: 1, duration: 1.1 }, t + 0.1)
          .fromTo(within(5, '[data-v="target"]'), { scale: 0.5, rotation: -30 }, { scale: 1, rotation: 0, duration: 1.6, ease: "power2.out" }, t + 0.3)
          .fromTo(within(5, '[data-v="bar"]'), { scaleY: 0 }, { scaleY: 1, duration: 0.6, stagger: 0.07, ease: "power3.out" }, t + 0.8)
          .fromTo(within(5, '[data-v="curve"]'), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" }, t + 1);
        reveal(5, t + 0.8);
        dt.to({}, { duration: 0.1 }, settled[5]);

        let shownPage = -1;
        dt.eventCallback("onUpdate", () => {
          const now = dt.time();
          let idx = 0;
          starts.forEach((s, i) => {
            if (now >= s + 0.5) idx = i;
          });
          if (idx !== shownPage) counter.textContent = pad((shownPage = idx) + 1);
          fills.forEach((f, i) => {
            f.style.transform = `scaleX(${gsap.utils.clamp(0, 1, (now - starts[i]) / (settled[i] - starts[i]))})`;
          });
        });

        /* ---------------- One master timeline, driven page by page ---------------- */
        const master = gsap.timeline({ paused: true });
        master.add(it, 0).add(dt, INTRO_END);
        const labels = [0, ...settled.map((s) => INTRO_END + s)];
        const last = labels.length - 1;
        drawAperture();

        let index = 0;
        let turning: gsap.core.Tween | null = null;
        let active = false;
        let leaving = false;
        let pending: number | null = null;
        let quietUntil = 0;

        const go = (to: number) => {
          to = gsap.utils.clamp(0, last, to);
          if (to === index && !turning) return;
          const from = master.time();
          const target = labels[to];
          let duration = PAGE_TURN;
          let ease = "power2.inOut";
          if (index === 0 && to >= 1 && from < labels[1]) {
            // The intro: one scroll plays the whole scene in real time.
            duration = INTRO_PLAY * ((labels[1] - from) / labels[1]) + (to - 1) * 0.6;
            ease = "none";
          } else if (to === 0) {
            duration = INTRO_REWIND + Math.max(0, index - 1) * 0.25;
          } else if (Math.abs(to - index) > 1) {
            duration = PAGE_TURN + (Math.abs(to - index) - 1) * 0.35;
          }
          turning?.kill();
          index = to;
          turning = master.tweenTo(target, {
            duration,
            ease,
            onComplete: () => {
              turning = null;
              quietUntil = performance.now() + INPUT_COOLDOWN;
            },
          });
        };

        const lock = (on: boolean) => {
          document.documentElement.style.overflow = on ? "hidden" : "";
          document.documentElement.style.overscrollBehavior = on ? "none" : "";
        };

        const activate = () => {
          if (active) return;
          active = true;
          lock(true);
          observer.enable();
          quietUntil = performance.now() + INPUT_COOLDOWN;
          if (pending !== null) {
            go(pending);
            pending = null;
          }
        };

        const leave = (scrollOn: boolean) => {
          // Until the page has actually moved away from the top, don't re-enter.
          leaving = true;
          if (!active) return;
          active = false;
          observer.disable();
          lock(false);
          if (scrollOn) {
            const next = document.getElementById("location");
            if (next) window.scrollTo({ top: next.getBoundingClientRect().top + window.scrollY, behavior: "smooth" });
          }
        };

        const step = (dir: 1 | -1) => {
          if (performance.now() < quietUntil) return;
          if (turning) {
            // Impatient during the intro? Fast-forward it instead of queueing pages.
            if (dir === 1 && index === 1 && master.time() < labels[1]) turning.timeScale(3);
            return;
          }
          if (dir === 1) {
            if (index < last) go(index + 1);
            else leave(true);
          } else if (index > 0) go(index - 1);
        };

        const observer = Observer.create({
          target: window,
          type: "wheel,touch",
          wheelSpeed: -1,
          tolerance: 12,
          preventDefault: true,
          onUp: () => step(1),
          onDown: () => step(-1),
        });
        observer.disable();

        const onKey = (e: KeyboardEvent) => {
          if (!active || (e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
          if (["ArrowDown", "PageDown", " "].includes(e.key)) {
            e.preventDefault();
            step(1);
          } else if (["ArrowUp", "PageUp"].includes(e.key)) {
            e.preventDefault();
            step(-1);
          }
        };
        window.addEventListener("keydown", onKey);

        // Re-enter the cinema when the visitor scrolls back to the very top.
        const onScroll = () => {
          if (leaving && window.scrollY > 80) leaving = false;
          if (!active && !leaving && window.scrollY <= 1) activate();
        };
        window.addEventListener("scroll", onScroll, { passive: true });

        const unregister = registerPager({
          go: (target: PageTarget) => {
            const to = target === "next" ? index + 1 : target === "prev" ? index - 1 : target;
            if (target === "next" && index === last && active) return leave(true);
            if (active) return go(to);
            pending = gsap.utils.clamp(0, last, to);
            leaving = false;
            if (window.scrollY <= 1) activate();
            else window.scrollTo({ top: 0, behavior: "smooth" });
          },
          leave: () => leave(false),
        });

        // Start on the eye at the top, or on the last service if the page loads scrolled down.
        const hash = window.location.hash.slice(1);
        if (window.scrollY > 1 || (hash && hash !== "home" && hash !== "services")) {
          index = last;
          master.seek(labels[last]);
          leaving = window.scrollY <= 1;
        } else {
          if (hash === "services") {
            index = 1;
            master.seek(labels[1]);
          }
          activate();
        }

        /* ---------------- Idle life on the eye: it follows the pointer and blinks ---------------- */
        const followX = gsap.quickTo(iris, "x", { duration: 0.7, ease: "power3" });
        const followY = gsap.quickTo(iris, "y", { duration: 0.7, ease: "power3" });
        const onMove = (e: PointerEvent) => {
          if (index !== 0 || turning) return;
          followX((e.clientX / window.innerWidth - 0.5) * 70);
          followY((e.clientY / window.innerHeight - 0.5) * 36);
        };
        window.addEventListener("pointermove", onMove, { passive: true });

        let blinkCall: gsap.core.Tween | undefined;
        const scheduleBlink = () => {
          blinkCall = gsap.delayedCall(gsap.utils.random(2.8, 5.5), () => {
            if (index === 0 && !turning && master.time() === 0) {
              const b = gsap.timeline({ defaults: { duration: 0.11, ease: "power2.in" } });
              b.to(upper, { attr: { d: LID.upperClosed } }, 0)
                .to(lower, { attr: { d: LID.lowerClosed } }, 0)
                .to([lashU, lashShadow], { attr: { d: LID.upperLashClosed } }, 0)
                .to(lashL, { attr: { d: LID.lowerLashClosed } }, 0)
                .to(upper, { attr: { d: LID.upperOpen }, duration: 0.16, ease: "power2.out" }, 0.13)
                .to(lower, { attr: { d: LID.lowerOpen }, duration: 0.16, ease: "power2.out" }, 0.13)
                .to([lashU, lashShadow], { attr: { d: LID.upperLashOpen }, duration: 0.16, ease: "power2.out" }, 0.13)
                .to(lashL, { attr: { d: LID.lowerLashOpen }, duration: 0.16, ease: "power2.out" }, 0.13);
            }
            scheduleBlink();
          });
        };
        scheduleBlink();

        const onResize = () => {
          if (master.time() < INTRO_END + 1.3) drawAperture();
        };
        window.addEventListener("resize", onResize);

        return () => {
          unregister();
          observer.kill();
          lock(false);
          turning?.kill();
          blinkCall?.kill();
          window.removeEventListener("keydown", onKey);
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("resize", onResize);
          slides[0].style.removeProperty("clip-path");
          el.classList.remove("is-live");
        };
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="cinema relative">
      <Intro />
      <ServicesDeck />
      <div className="cinema-grain pointer-events-none absolute inset-0 z-40" aria-hidden="true" />
    </div>
  );
}

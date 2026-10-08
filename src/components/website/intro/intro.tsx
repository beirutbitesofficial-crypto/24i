"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { EyeSvg, LID } from "./eye";
import { CameraRig, CAMERA_GLASS_RATIO } from "./camera";
import { Viewfinder } from "./viewfinder";
import { scrollToSection } from "@/lib/website/scroll";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const EYE_SCALE = 1.18;
const IRIS_RATIO = 132 / 1000;
const FPS = 24;
// Timeline seconds where the take starts and the director calls cut.
const REC_START = 5.4;
const CUT = 8.0;
const END = 9.0;

const pad = (n: number) => String(n).padStart(2, "0");
const timecode = (frames: number) => {
  const f = Math.max(0, Math.floor(frames));
  const s = Math.floor(f / FPS);
  return `01:${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(f % FPS)}`;
};

export function Intro() {
  const root = useRef<HTMLElement>(null);
  const eyeWrap = useRef<HTMLDivElement>(null);
  const eyeSvg = useRef<SVGSVGElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const hud = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const q = gsap.utils.selector(el);
      const one = (selector: string) => q(selector)[0] as Element;
      const mm = gsap.matchMedia();

      mm.add(
        { motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" },
        (ctx) => {
          const { reduce } = ctx.conditions as { motion: boolean; reduce: boolean };
          const tcEls = q("[data-tc]");
          const hudEl = hud.current!;

          if (reduce) {
            // Static, legible composition: the powered camera with a still REC frame.
            gsap.set(eyeWrap.current, { autoAlpha: 0 });
            gsap.set(rig.current, { autoAlpha: 1, scale: 0.6 });
            gsap.set(q("[data-cue], [data-skip]"), { autoAlpha: 0 });
            gsap.set(q('[data-cam="leds-on"], [data-cam="screen-on"], [data-cam="tally"]'), { autoAlpha: 1 });
            tcEls.forEach((n) => (n.textContent = timecode(0)));
            return;
          }

          const upper = one('[data-eye="lid-upper"]');
          const lower = one('[data-eye="lid-lower"]');
          const lashU = one('[data-eye="lash-upper"]');
          const lashL = one('[data-eye="lash-lower"]');
          const lashShadow = one('[data-eye="lash-shadow"]');
          const iris = one('[data-eye="iris"]');

          const startScale = () =>
            (eyeWrap.current!.offsetWidth * IRIS_RATIO * EYE_SCALE) / (rig.current!.offsetWidth * CAMERA_GLASS_RATIO);
          const diveScale = () =>
            (Math.hypot(window.innerWidth, window.innerHeight) / 2 / (rig.current!.offsetWidth * CAMERA_GLASS_RATIO)) * 1.15;

          let lastState = "";
          const tl = gsap.timeline({
            defaults: { ease: "power2.inOut" },
            scrollTrigger: {
              trigger: el,
              start: "top top",
              end: () => `+=${window.innerHeight * 4.6}`,
              pin: true,
              scrub: 0.8,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              refreshPriority: 1,
            },
            onUpdate: () => {
              const t = tl.time();
              const state = t < REC_START ? "idle" : t < CUT ? "rec" : "cut";
              const frames = (Math.min(Math.max(t, REC_START), CUT) - REC_START) * FPS * 2.2;
              const code = timecode(frames);
              tcEls.forEach((n) => {
                if (n.textContent !== code) n.textContent = code;
              });
              if (state !== lastState) {
                hudEl.dataset.rec = state;
                lastState = state;
              }
            },
          });

          const lids = (at: number, closed: boolean, duration: number) => {
            const ease = closed ? "power2.in" : "power2.out";
            tl.to(upper, { attr: { d: closed ? LID.upperClosed : LID.upperOpen }, duration, ease }, at)
              .to(lower, { attr: { d: closed ? LID.lowerClosed : LID.lowerOpen }, duration, ease }, at)
              .to(lashU, { attr: { d: closed ? LID.upperLashClosed : LID.upperLashOpen }, duration, ease }, at)
              .to(lashShadow, { attr: { d: closed ? LID.upperLashClosed : LID.upperLashOpen }, duration, ease }, at)
              .to(lashL, { attr: { d: closed ? LID.lowerLashClosed : LID.lowerLashOpen }, duration, ease }, at);
          };

          gsap.set(rig.current, { autoAlpha: 0 });
          gsap.set(hudEl, { autoAlpha: 0 });
          gsap.set(one('[data-eye="pupil"]'), { svgOrigin: "500 280" });
          gsap.set(one('[data-cam="focus-ring"]'), { svgOrigin: "500 350" });
          gsap.set(one('[data-cam="rec-btn"]'), { svgOrigin: "180 208" });

          // 1. The eye: title clears, the eye leans in, pupil dilates.
          tl.to(q("[data-hero]"), { yPercent: -35, autoAlpha: 0, duration: 0.8, ease: "power2.in", stagger: 0.05 }, 0)
            .to(q("[data-cue]"), { autoAlpha: 0, duration: 0.3 }, 0)
            .fromTo(eyeWrap.current, { scale: 1 }, { scale: EYE_SCALE, duration: 3.2, ease: "none" }, 0)
            .fromTo(one('[data-eye="pupil"]'), { scale: 1 }, { scale: 1.32, duration: 0.9 }, 0.2);

          // 2. Blink once, then blink again: the eye opens as a lens.
          lids(1.1, true, 0.3);
          lids(1.42, false, 0.36);
          lids(2.0, true, 0.38);
          tl.set(one('[data-eye="ball"]'), { autoAlpha: 0 }, 2.42)
            .set(one('[data-eye="lens"]'), { autoAlpha: 1 }, 2.42)
            .to(q("[data-glow]"), { opacity: 0.25, duration: 0.6 }, 2.2);
          lids(2.5, false, 0.6);

          // 3. Match cut to the camera, pull back and swing the rig round.
          tl.fromTo(rig.current, { autoAlpha: 0, scale: startScale, rotationX: 0, rotationY: 0, rotationZ: 0 }, { autoAlpha: 1, duration: 0.25, ease: "none" }, 3.2)
            .to(eyeWrap.current, { autoAlpha: 0, duration: 0.3, ease: "none" }, 3.25)
            .to(rig.current, { scale: 1, duration: 1.55, ease: "power3.inOut" }, 3.35)
            .to(rig.current, { rotationY: -34, rotationX: 10, rotationZ: -4, duration: 0.75 }, 3.35)
            .to(rig.current, { rotationY: 24, rotationX: 4, rotationZ: 2, duration: 0.75 }, 4.1)
            .to(rig.current, { rotationY: 0, rotationX: 0, rotationZ: 0, duration: 0.45, ease: "power2.out" }, 4.85)
            .fromTo(one('[data-cam="focus-ring"]'), { rotation: 0 }, { rotation: 240, duration: 1.9, ease: "power1.inOut" }, 3.35)
            .to(q("[data-glow]"), { opacity: 0.6, duration: 0.8 }, 3.6);

          // 4. Power on, press record.
          tl.to(one('[data-cam="leds-on"]'), { autoAlpha: 1, duration: 0.12, ease: "none" }, 5.0)
            .to(one('[data-cam="screen-on"]'), { autoAlpha: 1, duration: 0.25, ease: "power1.out" }, 5.05)
            .to(one('[data-cam="rec-btn"]'), { scale: 0.74, duration: 0.08, ease: "power1.in" }, REC_START - 0.1)
            .to(one('[data-cam="rec-btn"]'), { scale: 1, duration: 0.14, ease: "back.out(3)" }, REC_START - 0.02)
            .to(q('[data-cam="tally"], [data-cam="rec-btn-glow"]'), { autoAlpha: 1, duration: 0.08, ease: "none" }, REC_START)
            .fromTo(q("[data-cam-rec]"), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: "power2.out" }, REC_START);

          // 5. Dive through the lens into the viewfinder and roll.
          tl.to(q("[data-cam-rec]"), { autoAlpha: 0, duration: 0.15 }, 5.75)
            .to(q("[data-skip]"), { autoAlpha: 0, duration: 0.2 }, 5.6)
            .to(rig.current, { scale: diveScale, duration: 0.85, ease: "power3.in" }, 5.6)
            .to(rig.current, { autoAlpha: 0, duration: 0.15, ease: "none" }, 6.32)
            .to(hudEl, { autoAlpha: 1, duration: 0.3, ease: "none" }, 6.3)
            .fromTo(q("[data-vf-frame]"), { scale: 1.12 }, { scale: 1, duration: 0.5, ease: "power3.out" }, 6.3)
            .fromTo(q("[data-vf-scene]"), { scale: 1.1 }, { scale: 1, duration: 1.7, ease: "none" }, 6.3)
            .fromTo(q("[data-vf-line]"), { yPercent: 110 }, { yPercent: 0, duration: 0.45, stagger: 0.1, ease: "power3.out" }, 6.5)
            .fromTo(q("[data-vf-sweep]"), { xPercent: -120 }, { xPercent: 120, duration: 1.3, ease: "power1.inOut" }, 6.6);

          // 6. Cut. The viewfinder falls away and leaves the aperture.
          tl.fromTo(q("[data-vf-flash]"), { autoAlpha: 0 }, { autoAlpha: 0.85, duration: 0.04, ease: "none" }, CUT)
            .to(q("[data-vf-flash]"), { autoAlpha: 0, duration: 0.22, ease: "power1.out" }, CUT + 0.04)
            .to(q("[data-vf-frame]"), { scale: 1.45, autoAlpha: 0, duration: 0.6, ease: "power3.in" }, CUT + 0.15)
            .to(q("[data-vf-scene]"), { scale: 0.55, autoAlpha: 0, duration: 0.6, ease: "power3.in" }, CUT + 0.15)
            .fromTo(q("[data-hex]"), { scale: 0, autoAlpha: 0, rotation: -60 }, { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.4, ease: "back.out(2)" }, CUT + 0.55)
            .set(el, { autoAlpha: 0 }, END);

          // Idle life before the first scroll: the eye follows the pointer and blinks.
          const st = tl.scrollTrigger!;
          const followX = gsap.quickTo(iris, "x", { duration: 0.7, ease: "power3" });
          const followY = gsap.quickTo(iris, "y", { duration: 0.7, ease: "power3" });
          const onMove = (e: PointerEvent) => {
            if (st.progress > 0.08) return;
            followX(((e.clientX / window.innerWidth) - 0.5) * 70);
            followY(((e.clientY / window.innerHeight) - 0.5) * 36);
          };
          window.addEventListener("pointermove", onMove, { passive: true });

          let blinkCall: gsap.core.Tween | undefined;
          const scheduleBlink = () => {
            blinkCall = gsap.delayedCall(gsap.utils.random(2.8, 5.5), () => {
              if (st.progress === 0 && !st.isActive) {
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

          return () => {
            window.removeEventListener("pointermove", onMove);
            blinkCall?.kill();
          };
        },
      );

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="home" aria-label="24i Production intro" className="grain relative z-10 h-[100svh] overflow-hidden bg-ink [perspective:1400px]">
      <div data-glow className="pointer-events-none absolute left-1/2 top-1/2 h-[90vmin] w-[140vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,140,140,0.28),transparent)] opacity-60" />

      <div ref={eyeWrap} className="absolute left-1/2 top-1/2 w-[150vw] -translate-x-1/2 -translate-y-1/2 sm:w-[min(96vw,1120px)]">
        <EyeSvg ref={eyeSvg} />
      </div>

      <CameraRig ref={rig} />

      <div data-cam-rec className="pointer-events-none absolute left-1/2 top-[calc(50%+min(36vw,330px))] flex -translate-x-1/2 items-center gap-3 font-mono text-xs tracking-[0.3em] text-cream opacity-0 sm:text-sm">
        <span className="rec-blink inline-block h-2.5 w-2.5 rounded-full bg-rec shadow-[0_0_12px_#ff2a2a]" />
        REC <span data-tc>01:00:00:00</span>
      </div>

      <Viewfinder ref={hud} />

      <svg data-hex viewBox="-20 -20 40 40" className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 opacity-0" aria-hidden="true">
        <polygon points="16,0 8,13.86 -8,13.86 -16,0 -8,-13.86 8,-13.86" fill="#e9f2f2" />
        <polygon points="16,0 8,13.86 -8,13.86 -16,0 -8,-13.86 8,-13.86" fill="none" stroke="#19c2bd" strokeWidth="2" />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-full flex-col items-center justify-between px-6 pb-10 pt-28 text-center sm:pt-32">
        <div>
          <p data-hero className="font-mono text-[11px] uppercase tracking-[0.5em] text-mute sm:text-xs"><span className="normal-case">24i</span> Production · Beirut</p>
          <h1 data-hero className="font-wide mt-4 text-[clamp(2.6rem,9vw,8.5rem)] uppercase leading-[0.86]">
            <span className="sr-only">24i Production. </span>We see it<span className="text-teal-bright">.</span>
          </h1>
        </div>
        <div className="flex flex-col items-center gap-5">
          <p data-hero className="max-w-md text-balance text-sm text-cream/70 sm:text-base">
            Production, social, web, apps, systems and ads, framed through one lens.
          </p>
          <div data-cue className="flex flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4em] text-mute">
            Scroll to roll
            <span className="block h-10 w-px animate-pulse bg-gradient-to-b from-teal-bright to-transparent" />
          </div>
        </div>
      </div>

      <button
        type="button"
        data-skip
        onClick={() => scrollToSection("#services")}
        className="absolute bottom-6 right-5 z-20 rounded-full border border-cream/20 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-cream/70 transition hover:border-teal-bright hover:text-cream sm:right-8"
      >
        Skip intro
      </button>
    </section>
  );
}

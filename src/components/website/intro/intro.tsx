import { EyeSvg } from "./eye";
import { CameraRig } from "./camera";
import { Viewfinder } from "./viewfinder";
import { SkipIntro } from "./skip-intro";

/** Intro scene markup. All motion is driven by the Cinema controller (cinema.tsx). */
export function Intro() {
  return (
    <section id="home" aria-label="24i Production intro" className="cinema-intro relative z-10 h-[100svh] overflow-hidden bg-ink [perspective:1400px]">
      <div data-glow className="pointer-events-none absolute left-1/2 top-1/2 h-[90vmin] w-[140vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,140,140,0.28),transparent)] opacity-60" />

      <div data-eye-wrap className="absolute left-1/2 top-1/2 w-[150vw] -translate-x-1/2 -translate-y-1/2 will-change-transform sm:w-[min(96vw,1120px)]">
        <EyeSvg />
      </div>

      <CameraRig />

      <div data-cam-rec className="pointer-events-none absolute left-1/2 top-[calc(50%+min(36vw,330px))] flex -translate-x-1/2 items-center gap-3 font-mono text-xs tracking-[0.3em] text-cream opacity-0 sm:text-sm">
        <span className="rec-blink inline-block h-2.5 w-2.5 rounded-full bg-rec shadow-[0_0_12px_#ff2a2a]" />
        REC <span data-tc>01:00:00:00</span>
      </div>

      <Viewfinder />

      <svg data-hex viewBox="-20 -20 40 40" className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 opacity-0" aria-hidden="true">
        <polygon points="16,0 8,13.86 -8,13.86 -16,0 -8,-13.86 8,-13.86" fill="#e9f2f2" />
        <polygon points="16,0 8,13.86 -8,13.86 -16,0 -8,-13.86 8,-13.86" fill="none" stroke="#19c2bd" strokeWidth="2" />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-full flex-col items-center justify-between px-6 pb-10 pt-28 text-center sm:pt-32">
        <div>
          <p data-hero className="font-mono text-[11px] uppercase tracking-[0.5em] text-mute sm:text-xs"><span className="normal-case">24i</span> Production · Lebanon</p>
          <h1 data-hero className="font-wide mt-4 text-[clamp(2.6rem,9vw,8.5rem)] uppercase leading-[0.86]">
            <span className="sr-only">24i Production. </span>We see it<span className="text-teal-bright">.</span>
          </h1>
        </div>
        <div className="flex flex-col items-center gap-5">
          <p data-hero className="max-w-md text-balance text-sm text-cream/70 sm:text-base">
            Production, social, web, apps, systems and ads, framed through one lens.
          </p>
          <div data-cue className="flex flex-col items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4em] text-mute">
            Scroll once to roll
            <span className="block h-10 w-px animate-pulse bg-gradient-to-b from-teal-bright to-transparent" />
          </div>
        </div>
      </div>

      <SkipIntro />
    </section>
  );
}

import { forwardRef } from "react";

const Corner = ({ className }: { className: string }) => (
  <span className={`absolute h-8 w-8 border-cream/80 sm:h-12 sm:w-12 ${className}`} />
);

/** Full-screen camera viewfinder HUD shown while the take is rolling. */
export const Viewfinder = forwardRef<HTMLDivElement>(function Viewfinder(_, ref) {
  return (
    <div ref={ref} data-rec="idle" className="group pointer-events-none invisible absolute inset-0 opacity-0" aria-hidden="true">
      {/* What the camera sees */}
      <div data-vf-scene className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_50%_55%,#0f2a2a_0%,#060909_55%,#020303_100%)]">
        <div data-vf-sweep className="absolute inset-y-0 left-0 w-full bg-[linear-gradient(100deg,transparent_35%,rgba(25,194,189,0.18)_48%,rgba(233,242,242,0.35)_50%,rgba(25,194,189,0.18)_52%,transparent_65%)] mix-blend-screen" />
        <div className="absolute left-1/2 top-1/2 h-px w-[80vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-teal-bright/70 to-transparent shadow-[0_0_30px_6px_rgba(25,194,189,0.35)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center sm:gap-3">
          <span className="mask"><span data-vf-line className="font-mono text-[10px] uppercase tracking-[0.6em] text-mute sm:text-xs">Scene 01 · Take 01 · Roll i</span></span>
          <span className="mask">
            <span data-vf-line className="font-wide text-[clamp(2.4rem,10vw,9rem)] uppercase leading-[0.9]">
              <span className="group-data-[rec=cut]:hidden">Rolling</span>
              <span className="hidden group-data-[rec=cut]:inline">Cut<span className="text-rec">.</span></span>
            </span>
          </span>
          <span className="mask"><span data-vf-line className="font-mono text-[10px] uppercase tracking-[0.5em] text-teal-bright sm:text-xs"><span className="normal-case">24i</span> Production</span></span>
        </div>
      </div>

      {/* Guides */}
      <div data-vf-frame className="absolute inset-x-4 bottom-4 top-20 sm:inset-x-8 sm:bottom-8 sm:top-24">
        <Corner className="left-0 top-0 border-l-2 border-t-2" />
        <Corner className="right-0 top-0 border-r-2 border-t-2" />
        <Corner className="bottom-0 left-0 border-b-2 border-l-2" />
        <Corner className="bottom-0 right-0 border-b-2 border-r-2" />
        <div className="absolute inset-x-[8%] top-[12%] h-px bg-cream/15" />
        <div className="absolute inset-x-[8%] bottom-[12%] h-px bg-cream/15" />
        <div className="absolute left-1/2 top-1/2 h-6 w-px -translate-x-1/2 -translate-y-1/2 bg-cream/60" />
        <div className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 bg-cream/60" />

        <div className="absolute left-4 top-4 flex items-center gap-2 font-mono text-xs tracking-[0.25em] sm:left-6 sm:top-6 sm:text-sm">
          <span className="rec-blink inline-block h-3 w-3 rounded-full bg-rec shadow-[0_0_14px_#ff2a2a] group-data-[rec=cut]:animate-none group-data-[rec=cut]:bg-mute group-data-[rec=cut]:shadow-none" />
          <span className="text-rec group-data-[rec=cut]:hidden">REC</span>
          <span className="hidden text-mute group-data-[rec=cut]:inline">STBY</span>
        </div>
        <div className="absolute right-4 top-4 text-right font-mono text-xs tracking-[0.2em] sm:right-6 sm:top-6 sm:text-sm">
          <span className="text-mute">TC </span>
          <span data-tc>01:00:00:00</span>
        </div>
        <div className="absolute left-1/2 top-4 hidden -translate-x-1/2 font-mono text-[11px] tracking-[0.3em] text-cream/60 sm:top-6 md:block">A001C024 · A-CAM</div>

        <div className="absolute bottom-4 left-4 flex items-end gap-[3px] sm:bottom-6 sm:left-6" aria-hidden="true">
          {[0, 0.15, 0.3, 0.05, 0.22, 0.4].map((d, i) => (
            <span key={i} className="meter block h-6 w-[3px] bg-teal-bright/80" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
        <div className="absolute bottom-4 right-4 flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] text-cream/70 sm:bottom-6 sm:right-6 sm:text-xs">
          <span className="hidden sm:inline">4K DCI</span>
          <span>24 FPS</span>
          <span className="hidden sm:inline">180°</span>
          <span>ISO 800</span>
          <span className="hidden sm:inline">5600K</span>
          <span className="relative inline-block h-3 w-6 rounded-[2px] border border-cream/70 after:absolute after:-right-[3px] after:top-1/2 after:h-1.5 after:w-[2px] after:-translate-y-1/2 after:bg-cream/70">
            <span className="absolute inset-[2px] right-[30%] bg-teal-bright" />
          </span>
        </div>
      </div>

      <div data-vf-flash className="absolute inset-0 bg-cream opacity-0" />
    </div>
  );
});

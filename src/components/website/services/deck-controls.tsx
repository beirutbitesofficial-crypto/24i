"use client";

import { goToPage } from "@/lib/website/scroll";

const pad = (n: number) => String(n).padStart(2, "0");

/** Presentation HUD: page dots, counter and previous/next buttons. Pages 1..total are the services. */
export function DeckControls({ total }: { total: number }) {
  return (
    <div className="deck-live-only absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 px-6 pb-6 font-mono text-[10px] uppercase tracking-[0.35em] text-white mix-blend-difference sm:gap-6 sm:px-10 md:px-16 md:pb-8 md:text-xs">
      <span className="hidden sm:inline">
        <span className="normal-case">24i</span> · Services
      </span>
      <div className="flex flex-1 items-center gap-1.5 sm:max-w-sm">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goToPage(i + 1)}
            aria-label={`Go to service ${pad(i + 1)}`}
            className="group relative flex h-6 flex-1 items-center"
          >
            <span className="relative block h-[2px] w-full overflow-hidden bg-white/25 transition-[height] group-hover:h-[4px]">
              <span data-fill className="absolute inset-0 origin-left bg-white" style={{ transform: "scaleX(0)" }} />
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => goToPage("prev")} aria-label="Previous" className="grid h-8 w-8 place-items-center rounded-full border border-white/40 transition hover:bg-white hover:text-black">
          ↑
        </button>
        <span>
          <span data-counter>01</span> / {pad(total)}
        </span>
        <button type="button" onClick={() => goToPage("next")} aria-label="Next" className="grid h-8 w-8 place-items-center rounded-full border border-white/40 transition hover:bg-white hover:text-black">
          ↓
        </button>
      </div>
    </div>
  );
}

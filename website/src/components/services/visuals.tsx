/* Art-directed visuals for each service slide. Elements tagged with data-v="..."
   are animated by the presentation timeline in deck.tsx. */

export function ProductionVisual() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {/* anamorphic flare through the centre (the aperture opens onto it) */}
      <div data-v="flare" className="absolute left-1/2 top-1/2 h-[2px] w-[140vw] -translate-x-1/2 -translate-y-1/2 bg-[linear-gradient(90deg,transparent,rgba(25,194,189,0.2)_25%,#bff7f3_50%,rgba(25,194,189,0.2)_75%,transparent)] shadow-[0_0_40px_10px_rgba(25,194,189,0.35)]" />
      <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(233,242,242,0.9),rgba(25,194,189,0.25)_45%,transparent)] blur-md" />
      {/* light cone */}
      <div data-v="beam" className="absolute -top-[10%] right-[8%] h-[120%] w-[38vw] origin-top rotate-[18deg] bg-[linear-gradient(180deg,rgba(233,242,242,0.14),transparent_80%)] blur-2xl" />
      {/* 2.39:1 letterbox bars */}
      <div data-v="bar-top" className="absolute inset-x-0 top-0 h-[14%] bg-black" />
      <div data-v="bar-bottom" className="absolute inset-x-0 bottom-0 h-[14%] bg-black" />
      {/* film strip */}
      <div data-v="strip" className="absolute right-[6%] top-[-30%] hidden h-[160%] w-28 flex-col gap-3 border-x-[10px] border-dashed border-cream/10 bg-white/[0.02] px-2 py-3 md:flex lg:w-36">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="aspect-[4/3] w-full rounded-sm" style={{ background: `linear-gradient(${120 + i * 25}deg, rgba(0,140,140,${0.15 + (i % 4) * 0.08}), rgba(5,6,7,0.9))` }} />
        ))}
      </div>
    </div>
  );
}

const TILE_COLORS = ["#0f4f4d", "#19c2bd", "#e9f2f2", "#123234", "#008c8c", "#1e2a2c", "#7fe0d9", "#0b2627"];

function PhoneColumn({ offset, label }: { offset: number; label: string }) {
  return (
    <div className="relative h-[54vh] max-h-[560px] w-[min(26vw,220px)] min-w-[120px] overflow-hidden rounded-[28px] border border-cream/15 bg-ink-soft p-2 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
      <div className="absolute left-1/2 top-2 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-black" />
      <div data-v="feed" className="grid grid-cols-2 gap-1.5 pt-6">
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className="aspect-[4/5] rounded-md" style={{ background: `linear-gradient(160deg, ${TILE_COLORS[(i + offset) % 8]}, #050607)` }} />
        ))}
      </div>
      <div className="absolute inset-x-2 bottom-2 rounded-xl bg-black/70 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-cream/80 backdrop-blur">{label}</div>
    </div>
  );
}

export function SocialVisual() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-end overflow-hidden pr-[4vw]" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_40%,rgba(0,140,140,0.35),transparent_60%)]" />
      <div className="relative flex gap-3 opacity-40 md:gap-5 md:opacity-100 [perspective:1200px]">
        <div data-v="phone" className="translate-y-10 -rotate-6"><PhoneColumn offset={0} label="Post scheduled" /></div>
        <div data-v="phone" className="-translate-y-6"><PhoneColumn offset={3} label="Story · Live" /></div>
        <div data-v="phone" className="hidden translate-y-16 rotate-6 lg:block"><PhoneColumn offset={5} label="Reply sent" /></div>
      </div>
    </div>
  );
}

export function WebsitesVisual() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-end overflow-hidden pr-[3vw] [perspective:1400px]" aria-hidden="true">
      <div data-v="browser" className="w-[min(64vw,820px)] rounded-xl border border-ink/15 bg-white shadow-[0_50px_120px_rgba(5,6,7,0.25)] [transform:rotateX(18deg)_rotateY(-22deg)_rotateZ(4deg)] opacity-30 md:opacity-100">
        <div className="flex items-center gap-1.5 border-b border-ink/10 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-ink/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink/20" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink/20" />
          <span className="ml-4 h-5 flex-1 rounded-md bg-ink/5 px-3 font-mono text-[10px] leading-5 text-ink/40">yourbrand.com</span>
        </div>
        <div className="grid gap-3 p-4 sm:p-6">
          <div data-v="block" className="flex items-center justify-between">
            <span className="h-3 w-16 rounded bg-ink" />
            <span className="flex gap-2"><span className="h-2 w-10 rounded bg-ink/20" /><span className="h-2 w-10 rounded bg-ink/20" /><span className="h-2 w-10 rounded bg-teal" /></span>
          </div>
          <div data-v="block" className="relative h-[16vh] overflow-hidden rounded-lg bg-ink sm:h-40">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(25,194,189,0.6),transparent_60%)]" />
            <span className="absolute bottom-4 left-4 h-4 w-1/2 rounded bg-cream" />
            <span className="absolute bottom-10 left-4 h-2 w-1/4 rounded bg-cream/50" />
          </div>
          <div data-v="block" className="grid grid-cols-3 gap-3">
            <span className="h-20 rounded-lg bg-ink/10" />
            <span className="h-20 rounded-lg bg-teal/30" />
            <span className="h-20 rounded-lg bg-ink/10" />
          </div>
          <div data-v="block" className="flex gap-3">
            <span className="h-2 w-1/3 rounded bg-ink/15" />
            <span className="h-2 w-1/4 rounded bg-ink/15" />
          </div>
        </div>
      </div>
      <div data-v="cursor" className="absolute right-[22%] top-[58%] hidden h-5 w-5 rotate-[-20deg] border-l-[10px] border-t-[18px] border-l-transparent border-t-ink md:block" />
    </div>
  );
}

export function AppsVisual() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-end overflow-hidden pr-[8vw]" aria-hidden="true">
      <div className="absolute right-[10%] top-1/2 h-[70vmin] w-[70vmin] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(25,194,189,0.35),transparent)]" />
      <div data-v="orbit" className="absolute right-[calc(8vw+min(13vw,110px))] top-1/2 h-[min(64vh,600px)] w-[min(64vh,600px)] -translate-y-1/2 translate-x-1/2 rounded-full border border-cream/10 opacity-40 md:opacity-100">
        {[0, 72, 144, 216, 288].map((deg, i) => (
          <span
            key={deg}
            className="absolute left-1/2 top-1/2 h-11 w-11 rounded-[14px] border border-cream/15 shadow-lg"
            style={{ transform: `rotate(${deg}deg) translateY(calc(min(32vh,300px) * -1)) rotate(-${deg}deg) translate(-50%,-50%)`, background: `linear-gradient(140deg, ${TILE_COLORS[(i * 2) % 8]}, #050607)` }}
          />
        ))}
      </div>
      <div data-v="device" className="relative h-[min(58vh,520px)] w-[min(27vh,250px)] overflow-hidden rounded-[36px] border-[6px] border-[#1c2224] bg-ink shadow-[0_40px_100px_rgba(0,0,0,0.7)] opacity-40 md:opacity-100">
        <div className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        <div data-v="screens" className="flex h-[300%] flex-col">
          {[
            { tone: "from-teal to-ink", title: "Welcome" },
            { tone: "from-cream/90 to-cream/40", title: "Discover" },
            { tone: "from-[#123234] to-ink", title: "Checkout" },
          ].map((s) => (
            <div key={s.title} className={`relative h-1/3 bg-gradient-to-b ${s.tone} p-5 pt-12`}>
              <span className="block h-3 w-1/2 rounded bg-ink/70 mix-blend-difference" />
              <span className="mt-4 block h-24 rounded-2xl bg-black/25" />
              <span className="mt-3 grid grid-cols-2 gap-2"><span className="h-16 rounded-xl bg-black/20" /><span className="h-16 rounded-xl bg-black/20" /></span>
              <span className="absolute inset-x-5 bottom-6 block h-10 rounded-full bg-ink/80" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const NODES = [
  { x: 12, y: 30 }, { x: 30, y: 14 }, { x: 34, y: 52 }, { x: 52, y: 30 }, { x: 56, y: 72 },
  { x: 72, y: 18 }, { x: 76, y: 50 }, { x: 90, y: 34 }, { x: 88, y: 76 }, { x: 18, y: 74 },
];
const EDGES: [number, number][] = [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [3, 6], [5, 7], [6, 7], [6, 8], [4, 8], [9, 2], [9, 4]];

export function SystemsVisual() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(233,242,242,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(233,242,242,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-y-[8%] right-0 h-[84%] w-full opacity-40 md:w-[62%] md:opacity-100">
        {EDGES.map(([a, b]) => (
          <line key={`${a}-${b}`} data-v="edge" x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke="#19c2bd" strokeOpacity="0.6" strokeWidth="0.22" pathLength={1} strokeDasharray="1" />
        ))}
      </svg>
      <div className="absolute inset-y-[8%] right-0 h-[84%] w-full opacity-40 md:w-[62%] md:opacity-100">
        {NODES.map((n, i) => (
          <span key={i} data-v="node" className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
            <span className={`block rounded-full ${i % 3 === 0 ? "h-4 w-4 bg-teal-bright shadow-[0_0_24px_rgba(25,194,189,0.8)]" : "h-2.5 w-2.5 bg-cream"}`} />
            {i % 3 === 0 && <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-cream/60 lg:inline">{["CRM", "Billing", "Ops", "Reports"][i / 3]}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AdsVisual() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div data-v="target" className="absolute right-[-12vmin] top-1/2 h-[110vmin] w-[110vmin] -translate-y-1/2 opacity-50 md:opacity-100">
        {[100, 78, 56, 34, 14].map((s, i) => (
          <span key={s} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-ink/25" style={{ width: `${s}%`, height: `${s}%`, borderWidth: i === 4 ? 0 : 1, background: i === 4 ? "#050607" : undefined }} />
        ))}
      </div>
      <div className="absolute bottom-[14%] right-[6vw] flex h-[42vh] items-end gap-[1.2vw] opacity-50 md:opacity-100">
        {[22, 30, 26, 44, 52, 48, 66, 78, 92].map((h, i) => (
          <span key={i} data-v="bar" className="block w-[2.2vw] min-w-[10px] max-w-[34px] origin-bottom rounded-t-sm bg-ink" style={{ height: `${h}%`, opacity: 0.35 + i * 0.07 }} />
        ))}
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute bottom-[14%] right-[4vw] h-[46vh] w-[min(60vw,640px)] opacity-60 md:opacity-100">
        <path data-v="curve" d="M0,38 C18,36 26,30 40,26 C56,22 62,14 76,9 C86,5 92,3 100,1" fill="none" stroke="#050607" strokeWidth="0.6" pathLength={1} strokeDasharray="1" />
      </svg>
    </div>
  );
}

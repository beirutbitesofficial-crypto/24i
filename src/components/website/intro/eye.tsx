import { forwardRef } from "react";

/** Eyelid geometry. Each pair shares the same command structure so GSAP can tween the `d` attribute. */
export const LID = {
  upperOpen: "M-20,-320 L1020,-320 L1020,280 L940,280 Q500,-40 60,280 L-20,280 Z",
  upperClosed: "M-20,-320 L1020,-320 L1020,280 L940,280 Q500,345 60,280 L-20,280 Z",
  lowerOpen: "M-20,880 L1020,880 L1020,280 L940,280 Q500,600 60,280 L-20,280 Z",
  lowerClosed: "M-20,880 L1020,880 L1020,280 L940,280 Q500,295 60,280 L-20,280 Z",
  upperLashOpen: "M60,280 Q500,-40 940,280",
  upperLashClosed: "M60,280 Q500,345 940,280",
  lowerLashOpen: "M60,280 Q500,600 940,280",
  lowerLashClosed: "M60,280 Q500,295 940,280",
};

const ALMOND = "M60,280 Q500,-40 940,280 Q500,600 60,280 Z";

/** Deterministic pseudo random so server and client markup match. */
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const r2 = (n: number) => Math.round(n * 100) / 100;

const FIBERS = Array.from({ length: 168 }, (_, i) => {
  const angle = ((i / 168) * 360 + rand(i) * 2.2) * (Math.PI / 180);
  const inner = 50 + rand(i + 300) * 14;
  const outer = 104 + rand(i + 600) * 26;
  const bend = (rand(i + 900) - 0.5) * 0.12;
  return {
    d: `M${r2(500 + Math.cos(angle) * inner)},${r2(280 + Math.sin(angle) * inner)} Q${r2(500 + Math.cos(angle + bend) * ((inner + outer) / 2))},${r2(280 + Math.sin(angle + bend) * ((inner + outer) / 2))} ${r2(500 + Math.cos(angle) * outer)},${r2(280 + Math.sin(angle) * outer)}`,
    light: i % 3 === 0,
    opacity: r2(0.18 + rand(i + 1200) * 0.45),
    width: r2(0.8 + rand(i + 1500) * 1.8),
  };
});

const CRYPTS = Array.from({ length: 22 }, (_, i) => {
  const angle = (i / 22) * Math.PI * 2 + rand(i + 40) * 0.2;
  const r = 78 + rand(i + 80) * 30;
  return { cx: r2(500 + Math.cos(angle) * r), cy: r2(280 + Math.sin(angle) * r), rx: r2(4 + rand(i + 120) * 7), ry: r2(2 + rand(i + 160) * 3), rot: r2((angle * 180) / Math.PI) };
});

const VEINS = [
  "M66,282 C140,268 180,300 236,288 C262,282 280,296 300,292",
  "M78,292 C130,310 170,318 214,330",
  "M934,280 C870,262 832,292 778,276 C752,268 736,284 712,280",
  "M924,292 C880,318 838,320 800,336",
  "M120,250 C160,256 186,240 212,246",
  "M884,252 C846,258 820,242 790,250",
];

export const EyeSvg = forwardRef<SVGSVGElement>(function EyeSvg(_, ref) {
  return (
    <svg ref={ref} viewBox="0 0 1000 560" className="block h-auto w-full overflow-visible" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="eye-vignette" cx="50%" cy="50%" r="50%">
          <stop offset="0.45" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id="eye-mask" maskUnits="userSpaceOnUse" x="-20" y="-320" width="1040" height="1200">
          <rect x="-20" y="-60" width="1040" height="680" fill="url(#eye-vignette)" />
        </mask>
        <clipPath id="eye-almond">
          <path d={ALMOND} />
        </clipPath>
        <radialGradient id="sclera" cx="500" cy="270" r="460" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f7f4ef" />
          <stop offset="0.45" stopColor="#ebe3d9" />
          <stop offset="0.8" stopColor="#bfaea2" />
          <stop offset="1" stopColor="#6e5c55" />
        </radialGradient>
        <linearGradient id="lid-shadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#120c0a" stopOpacity="0.85" />
          <stop offset="0.38" stopColor="#120c0a" stopOpacity="0" />
          <stop offset="0.85" stopColor="#120c0a" stopOpacity="0" />
          <stop offset="1" stopColor="#120c0a" stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id="iris" cx="500" cy="280" r="134" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b2a12" />
          <stop offset="0.36" stopColor="#7a5a22" />
          <stop offset="0.48" stopColor="#1f8a84" />
          <stop offset="0.78" stopColor="#0d5f5c" />
          <stop offset="0.93" stopColor="#063331" />
          <stop offset="1" stopColor="#021313" />
        </radialGradient>
        <radialGradient id="pupil" cx="500" cy="280" r="52" gradientUnits="userSpaceOnUse">
          <stop offset="0.7" stopColor="#010202" />
          <stop offset="1" stopColor="#0a1212" />
        </radialGradient>
        <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0d0e" />
          <stop offset="0.5" stopColor="#1c1817" />
          <stop offset="1" stopColor="#0b0d0e" />
        </linearGradient>
        <radialGradient id="lens-glass" cx="470" cy="250" r="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1b2b3a" />
          <stop offset="0.5" stopColor="#081019" />
          <stop offset="1" stopColor="#010203" />
        </radialGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id="softer" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      <g mask="url(#eye-mask)">
        <g clipPath="url(#eye-almond)">
          {/* Eyeball */}
          <g data-eye="ball">
            <rect x="40" y="-40" width="920" height="640" fill="url(#sclera)" />
            <g stroke="#b2423c" fill="none" strokeLinecap="round" opacity="0.32">
              {VEINS.map((d) => <path key={d} d={d} strokeWidth="1.3" />)}
            </g>
            <g data-eye="iris">
              <circle cx="500" cy="280" r="138" fill="#0b0f0f" opacity="0.35" filter="url(#softer)" />
              <circle cx="500" cy="280" r="132" fill="url(#iris)" />
              <g fill="none" strokeLinecap="round">
                {FIBERS.map((f, i) => (
                  <path key={i} d={f.d} stroke={f.light ? "#8fe3d6" : "#03201f"} strokeWidth={f.width} opacity={f.opacity} />
                ))}
              </g>
              <g fill="#021817" opacity="0.55">
                {CRYPTS.map((c, i) => (
                  <ellipse key={i} cx={c.cx} cy={c.cy} rx={c.rx} ry={c.ry} transform={`rotate(${c.rot} ${c.cx} ${c.cy})`} />
                ))}
              </g>
              <circle cx="500" cy="280" r="70" fill="none" stroke="#d6a957" strokeWidth="7" strokeDasharray="3 5" opacity="0.4" />
              <circle cx="500" cy="280" r="128" fill="none" stroke="#010909" strokeWidth="9" opacity="0.85" />
              <circle data-eye="pupil" cx="500" cy="280" r="48" fill="url(#pupil)" />
              <ellipse cx="452" cy="226" rx="26" ry="17" fill="#fff" opacity="0.92" filter="url(#soft)" />
              <circle cx="560" cy="334" r="7" fill="#fff" opacity="0.5" />
              <path d="M408,300 Q500,372 592,300" fill="none" stroke="#9ff5ea" strokeWidth="4" opacity="0.12" filter="url(#soft)" />
            </g>
            <rect x="40" y="-40" width="920" height="640" fill="url(#lid-shadow)" />
          </g>

          {/* Lens face that replaces the eyeball during the transformation blink */}
          <g data-eye="lens" opacity="0">
            <rect x="40" y="-40" width="920" height="640" fill="#030405" />
            <circle cx="500" cy="280" r="228" fill="#0d1013" stroke="#1f2629" strokeWidth="4" />
            <circle cx="500" cy="280" r="211" fill="none" stroke="#2d3538" strokeWidth="19" strokeDasharray="5 13" />
            <circle cx="500" cy="280" r="168" fill="#07090a" stroke="#3a4448" strokeWidth="3" />
            <circle cx="500" cy="280" r="146" fill="#050607" stroke="#4a565a" strokeWidth="2" />
            <circle cx="500" cy="280" r="132" fill="url(#lens-glass)" />
            <circle cx="500" cy="280" r="96" fill="none" stroke="#7b5cff" strokeWidth="2" opacity="0.35" />
            <circle cx="500" cy="280" r="58" fill="none" stroke="#19c2bd" strokeWidth="2" opacity="0.4" />
            <path d="M420,214 A110,110 0 0 1 540,180" fill="none" stroke="#a78bff" strokeWidth="10" strokeLinecap="round" opacity="0.4" filter="url(#soft)" />
            <path d="M560,360 A100,100 0 0 1 470,372" fill="none" stroke="#19c2bd" strokeWidth="8" strokeLinecap="round" opacity="0.35" filter="url(#soft)" />
            <ellipse cx="452" cy="226" rx="22" ry="14" fill="#fff" opacity="0.7" filter="url(#soft)" />
          </g>

          {/* Shadow cast by the upper lid on the eyeball */}
          <path data-eye="lash-shadow" d={LID.upperLashOpen} fill="none" stroke="#000" strokeWidth="46" opacity="0.5" filter="url(#softer)" />
        </g>

        {/* Lids */}
        <path data-eye="lid-upper" d={LID.upperOpen} fill="url(#skin)" />
        <path data-eye="lid-lower" d={LID.lowerOpen} fill="url(#skin)" />
        <path data-eye="lash-upper" d={LID.upperLashOpen} fill="none" stroke="#050404" strokeWidth="9" strokeLinecap="round" />
        <path data-eye="lash-lower" d={LID.lowerLashOpen} fill="none" stroke="#2a1d1b" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        <path d="M30,250 Q500,-120 970,250" fill="none" stroke="#2b2422" strokeWidth="3" opacity="0.6" />
        <path d="M70,318 Q500,660 930,318" fill="none" stroke="#2b2422" strokeWidth="2" opacity="0.35" />
      </g>
    </svg>
  );
});

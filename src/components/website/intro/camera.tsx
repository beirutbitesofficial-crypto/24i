import { forwardRef } from "react";

/**
 * Front view of a cinema camera, split into depth planes. The planes sit in a
 * preserve-3d container so rotating the rig produces real parallax.
 * The lens is centred in the 1000x700 viewBox; its front glass has r=110.
 */
export const CAMERA_GLASS_RATIO = 110 / 1000;

const layer = "absolute inset-0 h-full w-full overflow-visible";

const KNURL = Array.from({ length: 72 }, (_, i) => i * 5);

export const CameraRig = forwardRef<HTMLDivElement>(function CameraRig(_, ref) {
  return (
    <div ref={ref} className="cam-rig invisible absolute left-1/2 top-1/2 aspect-[10/7] w-[96vw] -translate-x-1/2 -translate-y-1/2 opacity-0 sm:w-[min(88vw,980px)]  [transform-style:preserve-3d]" aria-hidden="true">
      {/* Rear: body, handle, monitor, rods */}
      <svg viewBox="0 0 1000 700" className={layer} style={{ transform: "translateZ(-120px)" }}>
        <defs>
          <linearGradient id="cam-metal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a3033" />
            <stop offset="0.5" stopColor="#15191b" />
            <stop offset="1" stopColor="#0b0d0e" />
          </linearGradient>
          <linearGradient id="cam-edge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#3c4549" />
            <stop offset="0.5" stopColor="#1a1f21" />
            <stop offset="1" stopColor="#3c4549" />
          </linearGradient>
          <linearGradient id="screen-on" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0f6f6c" />
            <stop offset="1" stopColor="#042a29" />
          </linearGradient>
          <radialGradient id="tally-glow">
            <stop offset="0" stopColor="#ff2a2a" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ff2a2a" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* rods + base plate */}
        <rect x="170" y="600" width="660" height="16" rx="8" fill="url(#cam-edge)" />
        <rect x="170" y="630" width="660" height="16" rx="8" fill="url(#cam-edge)" />
        <rect x="360" y="585" width="280" height="78" rx="10" fill="#101315" stroke="#272e31" strokeWidth="2" />
        {/* top handle */}
        <rect x="380" y="58" width="16" height="70" rx="5" fill="#1d2326" />
        <rect x="604" y="58" width="16" height="70" rx="5" fill="#1d2326" />
        <rect x="350" y="40" width="300" height="28" rx="14" fill="url(#cam-metal)" stroke="#31393c" strokeWidth="2" />
        {/* body */}
        <rect x="250" y="120" width="500" height="470" rx="26" fill="url(#cam-metal)" stroke="#2c3437" strokeWidth="3" />
        <g data-cam="leds">
          <circle cx="300" cy="150" r="5" fill="#1b2a2a" />
          <circle cx="318" cy="150" r="5" fill="#1b2a2a" />
          <circle cx="336" cy="150" r="5" fill="#1b2a2a" />
        </g>
        <g data-cam="leds-on" opacity="0">
          <circle cx="300" cy="150" r="5" fill="#19c2bd" />
          <circle cx="318" cy="150" r="5" fill="#19c2bd" />
          <circle cx="336" cy="150" r="5" fill="#f5c542" />
        </g>
        {/* tally light */}
        <circle cx="700" cy="150" r="9" fill="#3a1212" />
        <g data-cam="tally" opacity="0">
          <circle cx="700" cy="150" r="46" fill="url(#tally-glow)" />
          <circle cx="700" cy="150" r="9" fill="#ff2a2a" />
        </g>
        {/* side grip, left */}
        <rect x="120" y="230" width="120" height="250" rx="40" fill="#121517" stroke="#2a3134" strokeWidth="2" />
        <rect x="140" y="250" width="80" height="210" rx="30" fill="#0a0c0d" />
        <g data-cam="rec-btn">
          <circle cx="180" cy="208" r="20" fill="#1b0b0b" stroke="#3b1515" strokeWidth="3" />
          <circle cx="180" cy="208" r="12" fill="#c81e1e" />
        </g>
        <g data-cam="rec-btn-glow" opacity="0">
          <circle cx="180" cy="208" r="30" fill="url(#tally-glow)" />
        </g>
        {/* monitor arm + monitor, right */}
        <rect x="745" y="200" width="60" height="14" rx="7" fill="#20272a" />
        <rect x="790" y="120" width="190" height="130" rx="14" fill="#0e1112" stroke="#2c3437" strokeWidth="3" />
        <rect data-cam="screen" x="802" y="132" width="166" height="106" rx="6" fill="#050707" />
        <g data-cam="screen-on" opacity="0">
          <rect x="802" y="132" width="166" height="106" rx="6" fill="url(#screen-on)" />
          <text x="885" y="196" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="34" fill="#e9f2f2" style={{ fontStretch: "125%" }}>24i</text>
          <rect x="812" y="142" width="24" height="9" rx="2" fill="#ff2a2a" />
          <rect x="924" y="142" width="34" height="9" rx="2" fill="#e9f2f2" opacity="0.6" />
          <rect x="812" y="222" width="146" height="4" rx="2" fill="#e9f2f2" opacity="0.25" />
        </g>
      </svg>

      {/* Lens barrel */}
      <svg viewBox="0 0 1000 700" className={layer} style={{ transform: "translateZ(-10px)" }}>
        <defs>
          <radialGradient id="cam-glass" cx="470" cy="320" r="150" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#1b2b3a" />
            <stop offset="0.5" stopColor="#081019" />
            <stop offset="1" stopColor="#010203" />
          </radialGradient>
          <filter id="cam-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
          <path id="lens-text" d="M500,350 m-150,0 a150,150 0 1 1 300,0 a150,150 0 1 1 -300,0" />
        </defs>
        <circle cx="500" cy="350" r="190" fill="#0d1013" stroke="#1f2629" strokeWidth="4" />
        <g data-cam="focus-ring">
          <g stroke="#2d3538" strokeWidth="5" strokeLinecap="round">
            {KNURL.map((deg) => (
              <line key={deg} x1="500" y1="168" x2="500" y2="184" transform={`rotate(${deg} 500 350)`} />
            ))}
          </g>
          <text fill="#8a9a9c" fontFamily="var(--font-mono)" fontSize="13" letterSpacing="3">
            <textPath href="#lens-text">24i CINE PRIME · 35mm · T1.5 · ∞ · 10 · 5 · 3 · 2 · 1.5 · 1.2 · 1m ·</textPath>
          </text>
        </g>
        <circle cx="500" cy="350" r="140" fill="#07090a" stroke="#3a4448" strokeWidth="3" />
      </svg>

      {/* Front glass */}
      <svg viewBox="0 0 1000 700" className={layer} style={{ transform: "translateZ(30px)" }}>
        <circle cx="500" cy="350" r="122" fill="#050607" stroke="#4a565a" strokeWidth="2" />
        <circle cx="500" cy="350" r="110" fill="url(#cam-glass)" />
        <circle cx="500" cy="350" r="80" fill="none" stroke="#7b5cff" strokeWidth="2" opacity="0.35" />
        <circle cx="500" cy="350" r="48" fill="none" stroke="#19c2bd" strokeWidth="2" opacity="0.4" />
        <path d="M434,295 A92,92 0 0 1 534,266" fill="none" stroke="#a78bff" strokeWidth="9" strokeLinecap="round" opacity="0.4" filter="url(#cam-soft)" />
        <path d="M550,416 A84,84 0 0 1 475,426" fill="none" stroke="#19c2bd" strokeWidth="7" strokeLinecap="round" opacity="0.35" filter="url(#cam-soft)" />
        <ellipse cx="460" cy="305" rx="18" ry="12" fill="#fff" opacity="0.7" filter="url(#cam-soft)" />
      </svg>

      {/* Matte box */}
      <svg viewBox="0 0 1000 700" className={layer} style={{ transform: "translateZ(90px)" }}>
        <defs>
          <linearGradient id="mb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#262c2f" />
            <stop offset="1" stopColor="#0e1112" />
          </linearGradient>
        </defs>
        <path
          fillRule="evenodd"
          d="M282,128 h436 a22,22 0 0 1 22,22 v400 a22,22 0 0 1 -22,22 h-436 a22,22 0 0 1 -22,-22 v-400 a22,22 0 0 1 22,-22 Z M318,162 h364 a10,10 0 0 1 10,10 v356 a10,10 0 0 1 -10,10 h-364 a10,10 0 0 1 -10,-10 v-356 a10,10 0 0 1 10,-10 Z"
          fill="url(#mb)"
          stroke="#363f43"
          strokeWidth="2"
        />
        <path d="M300,128 L330,92 H670 L700,128 Z" fill="#171b1d" stroke="#2f383b" strokeWidth="2" />
        <text x="292" y="586" fill="#5d6a6d" fontFamily="var(--font-mono)" fontSize="13" letterSpacing="4">24i · A-CAM</text>
      </svg>
    </div>
  );
});

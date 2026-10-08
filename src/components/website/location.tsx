import { site } from "@/lib/website/site";
import { Reveal } from "./reveal";
import { LocalTime } from "./local-time";

export function Location() {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&z=14&output=embed`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(site.mapQuery)}`;
  return (
    <Reveal as="section" id="location" aria-labelledby="location-title" className="relative bg-ink px-6 pb-24 pt-32 sm:px-10 md:px-16 md:pb-32 md:pt-40">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p data-r className="font-mono text-xs uppercase tracking-[0.4em] text-teal-bright">Location</p>
            <h2 id="location-title" className="font-wide mt-4 text-[clamp(3rem,11vw,10rem)] uppercase leading-[0.85]">
              <span className="mask block"><span data-r-line>Find the</span></span>
              <span className="mask block"><span data-r-line>studio<span className="text-teal-bright">.</span></span></span>
            </h2>
          </div>
          <dl className="grid grid-cols-2 gap-x-10 gap-y-6 font-mono text-xs uppercase tracking-[0.25em] md:text-right">
            <div data-r>
              <dt className="text-mute">Based in</dt>
              <dd className="mt-2 text-cream">{site.address}</dd>
            </div>
            <div data-r>
              <dt className="text-mute">Local time</dt>
              <dd className="mt-2 text-cream">
                <LocalTime timeZone={site.timezone} />
              </dd>
            </div>
            <div data-r>
              <dt className="text-mute">Visits</dt>
              <dd className="mt-2 text-cream">By appointment</dd>
            </div>
            <div data-r>
              <dt className="text-mute">Coverage</dt>
              <dd className="mt-2 text-cream">On location, anywhere</dd>
            </div>
          </dl>
        </div>

        <div data-r-wipe className="relative mt-14 overflow-hidden border border-cream/10 md:mt-20">
          <iframe
            title={`Map showing ${site.address}`}
            src={mapSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="block aspect-[4/5] w-full grayscale invert-[0.92] hue-rotate-180 contrast-[1.1] sm:aspect-[16/9] md:aspect-[21/9]"
          />
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_40px_rgba(5,6,7,0.85)]" />
          <div className="pointer-events-none absolute bottom-5 left-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-cream sm:bottom-8 sm:left-6">
            <span className="rec-blink h-2 w-2 rounded-full bg-rec" /> On location
          </div>
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 rounded-full bg-cream px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-ink transition hover:bg-teal-bright sm:bottom-6 sm:right-6"
          >
            Get directions ↗
          </a>
        </div>
      </div>
    </Reveal>
  );
}

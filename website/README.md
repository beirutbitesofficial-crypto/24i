# 24i Production: website

Marketing website for 24i Production. It is a standalone Next.js app that lives next to the agency OS in this repository.

**Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS 4 and GSAP ScrollTrigger. Fonts (Archivo, Inter, JetBrains Mono) are self-hosted through Fontsource.

## Page structure

1. **Cinematic eye intro.** A realistic SVG eye follows the pointer and blinks while the page is idle.
2. **Eye-to-camera transformation.** Scrolling makes the eye blink twice. On the second blink it opens as a lens. A match cut then pulls back to a layered 3D cinema camera, which swings round.
3. **Camera recording activation.** The camera powers on (LEDs and monitor), the record button is pressed, the tally light turns red and a REC timecode appears. The view then dives through the lens into a full-screen viewfinder showing ROLLING, then CUT. The viewfinder falls away and leaves the aperture.
4. **Full-screen services presentation.** One pinned, scrubbed ScrollTrigger deck with six 100svh slides. Each slide has its own visual and its own transition: hex aperture, vertical wipe, perspective shift, diagonal wipe, centre split and push-through. A live 0X / 06 counter and a progress bar sit at the bottom.
5. **Location.** A dark-styled map embed, Beirut local time and a directions link.
6. **Contact Us.** A validated form posts to `/api/contact`.
7. **Book a Meeting.** A built-in request form posts to `/api/book`. If `NEXT_PUBLIC_BOOKING_URL` is set, a Cal.com or Calendly embed is shown instead.
8. **Minimal footer.**

### Motion and accessibility

- With `prefers-reduced-motion: reduce`, nothing is pinned or scrubbed. The intro shows a still powered-on camera, and the slides stack as normal full-height sections.
- Without JavaScript, the slides also render as stacked sections, so all service content stays in the HTML.
- Pinned sections have a fixed length: about 4.6 viewports for the intro and 6.4 for the deck. There is no snapping, and touch scrolling stays native. A **Skip intro** button and the nav links jump straight to any section.

## Develop

```bash
cd website
npm install
cp .env.example .env.local   # fill in contact details and form delivery
npm run dev
```

`npm run build` then `npm start` runs it in production mode.

## Configuration

See `.env.example`. Contact channels (email, phone, WhatsApp, Instagram) only appear when they are set.

Form delivery needs at least one of the following in production:

- `RESEND_API_KEY` + `FORM_TO_EMAIL` (and optionally `FORM_FROM_EMAIL` on a verified domain) to send email through Resend.
- `FORM_WEBHOOK_URL` to send a JSON POST to Zapier, Make, n8n, Slack and similar tools.

If neither is configured, production submissions return a 503 with a "reach us directly" message, so no enquiry is silently lost. In development they are logged to the console.

## Deploy

On Vercel (or a similar host), set the project **Root Directory** to `website/`.

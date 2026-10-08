import { Nav } from "@/components/website/nav";
import { Intro } from "@/components/website/intro/intro";
import { ServicesDeck } from "@/components/website/services/deck";
import { Location } from "@/components/website/location";
import { Contact } from "@/components/website/contact";
import { Book } from "@/components/website/book";
import { Footer } from "@/components/website/footer";
import { HashScroll } from "@/components/website/hash-scroll";

export default function Home() {
  return (
    <>
      <a href="#services" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-cream focus:px-4 focus:py-2 focus:text-ink">
        Skip to services
      </a>
      <Nav />
      <main>
        <Intro />
        <ServicesDeck />
        <Location />
        <Contact />
        <Book />
      </main>
      <Footer />
      <HashScroll />
    </>
  );
}

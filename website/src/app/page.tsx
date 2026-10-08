import { Nav } from "@/components/nav";
import { Intro } from "@/components/intro/intro";
import { ServicesDeck } from "@/components/services/deck";
import { Location } from "@/components/location";
import { Contact } from "@/components/contact";
import { Book } from "@/components/book";
import { Footer } from "@/components/footer";
import { HashScroll } from "@/components/hash-scroll";

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

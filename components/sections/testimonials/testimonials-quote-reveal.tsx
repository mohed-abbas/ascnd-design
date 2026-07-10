"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

// useLayoutEffect on the client (park the split before paint if the quote is
// already in view on load); falls back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Testimonials pull-quote reveal — the same word-by-word blur-rise the section
 * headings use (see comparison-reveal.tsx): SplitText splits the mixed-font
 * quote into words; each rises a touch, fades in and clears from a soft blur to
 * crisp, staggered, when the quote scrolls in (once).
 *
 * Renders nothing — drives [data-testimonials-quote].
 *
 * Anchored to the QUOTE element, not the section: the section is min-h-dvh with
 * the quote centred in it, so a section-top trigger (as the sibling headings
 * use) would run the reveal while the quote is still below the fold. Firing off
 * the quote's own top ("top 80%") plays it as the quote actually enters view —
 * a beat ahead of the rocks flying in (testimonial-rocks.tsx, "center 60%").
 *
 * House-rules compliance: rides GSAP's shared ticker (LenisProvider), one-shot
 * so it idles to zero, and SSR / no-JS / reduced-motion render the FINISHED
 * quote (no hidden markup) — glyphs are hidden only once we know we'll animate.
 */
export default function TestimonialsQuoteReveal() {
  useIsomorphicLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-testimonials]");
    if (!section) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const quote = section.querySelector<HTMLElement>(
      "[data-testimonials-quote]",
    );
    if (!quote) return;

    let ctx: gsap.Context | undefined;
    let split: SplitText | undefined;
    let cancelled = false;

    // Hide the quote synchronously, before fonts resolve, so no finished-state
    // flash shows if the page loads already scrolled here.
    gsap.set(quote, { autoAlpha: 0 });

    const build = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        split = new SplitText(quote, { type: "words" });
        gsap.set(quote, { autoAlpha: 1 }); // container shown; words parked below

        gsap.fromTo(
          split.words,
          { yPercent: 40, autoAlpha: 0, filter: "blur(8px)" },
          {
            yPercent: 0,
            autoAlpha: 1,
            filter: "blur(0px)",
            duration: 0.7,
            ease: "power3.out",
            stagger: 0.06,
            clearProps: "filter",
            scrollTrigger: { trigger: quote, start: "top 80%", once: true },
          },
        );
      }, section);
    };

    // Defer until fonts are ready so SplitText measures the real glyph metrics
    // (Product Sans + Instrument Serif) — otherwise words mis-measure on swap.
    if (!document.fonts || document.fonts.status === "loaded") build();
    else document.fonts.ready.then(build);

    return () => {
      cancelled = true;
      ctx?.revert(); // kills the tween + its ScrollTrigger, unwraps the split
      split?.revert();
      // Drop the pre-build hide so the resting quote shows if we never built.
      gsap.set(quote, { clearProps: "opacity,visibility" });
    };
  }, []);

  return null;
}

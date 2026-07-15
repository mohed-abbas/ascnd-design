"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

// useLayoutEffect on the client (park the split before paint if the section is
// already in view on load); falls back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * FAQ heading reveal (Figma 526:413) — the SAME word-by-word blur-rise the
 * cards / working-with / comparison headings use: SplitText splits the mixed-font
 * "questions, answered straight" heading into words; each rises a touch, fades in
 * and clears from a soft blur to crisp, staggered, when the section scrolls in
 * (once).
 *
 * Renders nothing — drives [data-faq-head].
 *
 * House-rules compliance: rides GSAP's shared ticker (LenisProvider), one-shot so
 * it idles to zero, and SSR / no-JS / reduced-motion render the FINISHED heading
 * (no hidden markup) — glyphs are hidden only once we know we'll animate.
 */
export default function FaqReveal() {
  useIsomorphicLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-faq]");
    if (!section) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const head = section.querySelector<HTMLElement>("[data-faq-head]");
    if (!head) return;

    let ctx: gsap.Context | undefined;
    let split: SplitText | undefined;
    let cancelled = false;

    // Hide the heading synchronously, before fonts resolve, so no finished-state
    // flash shows if the page loads already scrolled here.
    gsap.set(head, { autoAlpha: 0 });

    const build = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        split = new SplitText(head, { type: "words" });
        gsap.set(head, { autoAlpha: 1 }); // container shown; words parked below

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
            scrollTrigger: { trigger: section, start: "top 80%", once: true },
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
      ctx?.revert(); // kills the timeline + its ScrollTrigger, unwraps the split
      split?.revert();
      // Drop the pre-build hide so the resting heading shows if we never built.
      gsap.set(head, { clearProps: "opacity,visibility" });
    };
  }, []);

  return null;
}

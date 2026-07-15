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
 * Comparison reveal (Figma 469:550) — the same word-by-word blur-rise the cards
 * + working-with headings use: SplitText splits the mixed-font "…none of the
 * above." heading into words; each rises a touch, fades in and clears from a
 * soft blur to crisp, staggered, when the section scrolls in (once). The
 * supporting line settles a beat later, and the glass matrix table blur-rises in
 * behind it — the same de-frost the pricing / cards-section shells use, so the
 * whole table materialises instead of just appearing finished.
 *
 * Renders nothing — drives [data-comparison-head] / -sub / -card.
 *
 * House-rules compliance: rides GSAP's shared ticker (LenisProvider), one-shot
 * so it idles to zero, and SSR / no-JS / reduced-motion render the FINISHED
 * section (no hidden markup) — elements are hidden only once we know we'll
 * animate. The table's entrance blur is a foreground filter that clearProps
 * drops, leaving the card's own backdrop-blur untouched.
 */
export default function ComparisonReveal() {
  useIsomorphicLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-comparison]");
    if (!section) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const head = section.querySelector<HTMLElement>("[data-comparison-head]");
    const sub = section.querySelector<HTMLElement>("[data-comparison-sub]");
    // Both the desktop grid and the mobile stack carry [data-comparison-card];
    // only one is display-visible per viewport, so animating the array rises
    // whichever is shown (the hidden one is a no-op).
    const cards = gsap.utils.toArray<HTMLElement>(
      "[data-comparison-card]",
      section,
    );
    if (!head) return;

    let ctx: gsap.Context | undefined;
    let split: SplitText | undefined;
    let cancelled = false;

    // Hide the heading (+ sub + table) synchronously, before fonts resolve, so no
    // finished-state flash shows if the page loads already scrolled here.
    gsap.set([head, sub, ...cards].filter(Boolean) as HTMLElement[], {
      autoAlpha: 0,
    });

    const build = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        split = new SplitText(head, { type: "words" });
        gsap.set(head, { autoAlpha: 1 }); // container shown; words parked below

        const tl = gsap.timeline({
          scrollTrigger: { trigger: section, start: "top 80%", once: true },
        });

        tl.fromTo(
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
          },
          0,
        );

        if (sub) {
          tl.fromTo(
            sub,
            { autoAlpha: 0, y: 12 },
            { autoAlpha: 1, y: 0, duration: 0.7, ease: "power2.out" },
            0.3,
          );
        }

        // The glass matrix table blur-rises in behind the heading — same recipe
        // as the pricing / cards-section shells (parks below + fogged, de-frosts
        // to crisp). clearProps drops the entrance filter so only the card's own
        // backdrop-blur remains at rest.
        if (cards.length) {
          tl.fromTo(
            cards,
            { y: 36, autoAlpha: 0, filter: "blur(10px)" },
            {
              y: 0,
              autoAlpha: 1,
              filter: "blur(0px)",
              duration: 0.8,
              ease: "power3.out",
              clearProps: "filter",
            },
            0.35,
          );
        }
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
      gsap.set([head, sub].filter(Boolean) as HTMLElement[], {
        clearProps: "opacity,visibility",
      });
    };
  }, []);

  return null;
}

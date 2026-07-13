"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

// useLayoutEffect on the client (park the reveal before paint if the section is
// already in view on load); falls back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * "simple pricing" scroll reveal (Figma node 469:680). One-shot on enter:
 *
 *  HEADING — the same word-by-word blur-rise the cards + working-with headings
 *  use: SplitText splits the mixed-font "simple pricing, pause anytime" into
 *  words; each rises, fades in and clears from a soft blur, staggered. The
 *  supporting line settles a beat later.
 *
 *  BODY — the two plan cards lift in with a beat between them (subscription
 *  first, then the offset sprint card), the badge and connector arrow fade in,
 *  and the footer settles last.
 *
 * Renders nothing — drives the [data-pricing-*] nodes authored in pricing.tsx.
 *
 * House-rules compliance:
 * - Rides GSAP's shared ticker (LenisProvider) — no private rAF.
 * - IDLES TO ZERO: a single `once: true` timeline; nothing repaints after it
 *   plays or on a still page.
 * - SSR / no-JS / reduced-motion render the FINISHED layout (no hidden markup);
 *   elements (and the heading's split words) are hidden only once we know we'll
 *   animate, and the split is deferred until fonts resolve so it measures the
 *   real glyph metrics.
 */
export default function PricingReveal() {
  useIsomorphicLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-pricing]");
    if (!section) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const head = section.querySelector<HTMLElement>("[data-pricing-head]");
    const sub = section.querySelector<HTMLElement>("[data-pricing-sub]");
    const cards = gsap.utils.toArray<HTMLElement>("[data-pricing-card]", section);
    const badge = section.querySelector<HTMLElement>("[data-pricing-badge]");
    const arrow = section.querySelector<HTMLElement>("[data-pricing-arrow]");
    const foot = gsap.utils.toArray<HTMLElement>("[data-pricing-foot]", section);
    if (!head || cards.length === 0) return;

    let ctx: gsap.Context | undefined;
    let split: SplitText | undefined;
    let cancelled = false;

    // Hide the animated pieces synchronously (before fonts resolve) so no
    // finished-state flash shows if the page loads already scrolled here.
    const hidden = [head, sub, ...cards, badge, arrow, ...foot].filter(
      (el): el is HTMLElement => el != null,
    );
    gsap.set(hidden, { autoAlpha: 0 });

    const build = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        split = new SplitText(head, { type: "words" });
        gsap.set(head, { autoAlpha: 1 }); // container shown; words parked below

        const tl = gsap.timeline({
          scrollTrigger: { trigger: section, start: "top 75%", once: true },
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

        // The two plan cards blur-rise in, same as the cards-section glass
        // shells: each parks below + fogged (foreground blur) and de-frosts to
        // crisp, subscription first then the offset sprint. clearProps drops the
        // entrance filter so only each card's own backdrop-blur remains at rest.
        tl.fromTo(
          cards,
          { y: 36, autoAlpha: 0, filter: "blur(10px)" },
          {
            y: 0,
            autoAlpha: 1,
            filter: "blur(0px)",
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.14,
            clearProps: "filter",
          },
          0.35,
        )
          .fromTo(
            [badge, arrow].filter(Boolean) as HTMLElement[],
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.7, ease: "power2.out" },
            0.7,
          )
          .fromTo(
            foot,
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.7, ease: "power2.out" },
            0.8,
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
      // Drop the pre-build hide so the resting layout shows if we never built.
      gsap.set(hidden, { clearProps: "opacity,visibility" });
    };
  }, []);

  return null;
}

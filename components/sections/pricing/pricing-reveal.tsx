"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// useLayoutEffect on the client (park the reveal before paint if the section is
// already in view on load); falls back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * "simple pricing" scroll reveal (Figma node 469:680). One-shot on enter: the
 * header rises and clears from a soft blur, the two plan cards lift in with a
 * beat between them (subscription first, then the offset sprint card), the badge
 * and connector arrow fade in behind them, and the footer settles last.
 *
 * Renders nothing — drives the [data-pricing-*] nodes authored in pricing.tsx.
 *
 * House-rules compliance:
 * - Rides GSAP's shared ticker (LenisProvider) — no private rAF.
 * - IDLES TO ZERO: a single `once: true` timeline; nothing repaints after it
 *   plays or on a still page.
 * - SSR / no-JS / reduced-motion render the FINISHED layout (no hidden markup);
 *   elements are hidden only once we know we'll animate.
 */
export default function PricingReveal() {
  useIsomorphicLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-pricing]");
    if (!section) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const head = section.querySelector<HTMLElement>("[data-pricing-head]");
    const cards = gsap.utils.toArray<HTMLElement>("[data-pricing-card]", section);
    const badge = section.querySelector<HTMLElement>("[data-pricing-badge]");
    const arrow = section.querySelector<HTMLElement>("[data-pricing-arrow]");
    const foot = section.querySelector<HTMLElement>("[data-pricing-foot]");
    if (!head || cards.length === 0) return;

    // Hide the animated pieces synchronously (before paint) so no finished-state
    // flash shows if the page loads already scrolled to this section.
    const hidden = [head, ...cards, badge, arrow, foot].filter(
      (el): el is HTMLElement => el != null,
    );
    gsap.set(hidden, { autoAlpha: 0 });

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: section, start: "top 75%", once: true },
      });

      tl.fromTo(
        head,
        { yPercent: 30, autoAlpha: 0, filter: "blur(8px)" },
        {
          yPercent: 0,
          autoAlpha: 1,
          filter: "blur(0px)",
          duration: 0.8,
          ease: "power3.out",
          clearProps: "filter",
        },
        0,
      )
        .fromTo(
          cards,
          { y: 48, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.9,
            ease: "power3.out",
            stagger: 0.14,
          },
          0.15,
        )
        .fromTo(
          [badge, arrow].filter(Boolean) as HTMLElement[],
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.7, ease: "power2.out" },
          0.5,
        )
        .fromTo(
          foot,
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.7, ease: "power2.out" },
          0.6,
        );
    }, section);

    return () => {
      ctx.revert(); // kills the timeline + its ScrollTrigger, restores markup
    };
  }, []);

  return null;
}

"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// useLayoutEffect on the client (parks the titles before paint if the row is
// already in view on load); falls back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Card titles reveal — the three card headings (subscribe · request · receive)
 * blur-reveal one after another as the card row scrolls into view: each rises a
 * touch, fades in, and clears from a soft blur to crisp (the same mechanic as the
 * hero / cards / why-stay headings). The titles are single words, so the element
 * itself is the "word"; the cascade is the stagger across the three cards.
 *
 * JS-/motion-gated: SSR, no-JS and reduced-motion render the finished titles
 * (there's no hidden state in the markup) — the fromTo only parks them once we
 * know we'll animate (immediateRender applies the hidden start in this layout
 * effect, before paint), then reveals on ScrollTrigger enter (once).
 */
export default function CardTitlesReveal() {
  useIsomorphicLayoutEffect(() => {
    const titles = gsap.utils.toArray<HTMLElement>("[data-card-title]");
    const row = document.querySelector<HTMLElement>("[data-cards-row]");
    if (!titles.length || !row) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        titles,
        { yPercent: 40, autoAlpha: 0, filter: "blur(8px)" },
        {
          yPercent: 0,
          autoAlpha: 1,
          filter: "blur(0px)",
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.12, // one card heading after the next
          clearProps: "filter", // drop the inline filter once crisp
          scrollTrigger: { trigger: row, start: "top 80%", once: true },
        },
      );
    });

    return () => ctx.revert(); // kills the tween + its ScrollTrigger, restores the titles
  }, []);

  return null;
}

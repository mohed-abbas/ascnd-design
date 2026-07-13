"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// useLayoutEffect on the client (parks the cards before paint if the row is
// already in view on load); falls back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Cards reveal — the three glass card shells (subscribe · request · receive)
 * materialize one after another as the row scrolls into view: each rises a
 * touch, fades in, and clears from a soft blur to crisp, left→right. This is the
 * same blur-reveal mechanic the hero / headings / card titles use, now applied
 * to the whole panel — so the title and the inner media (cursor, conveyor,
 * collage) ride inside each shell and de-frost with it, instead of the shells
 * popping in finished while only the titles animated.
 *
 * JS-/motion-gated: SSR, no-JS and reduced-motion render the finished cards
 * (there's no hidden state in the markup) — the fromTo only parks them once we
 * know we'll animate (immediateRender applies the hidden start in this layout
 * effect, before paint), then reveals on ScrollTrigger enter (once). The card's
 * own backdrop-blur is left untouched; the entrance blur is a foreground filter
 * that clearProps drops once crisp.
 */
export default function CardsReveal() {
  useIsomorphicLayoutEffect(() => {
    const shells = gsap.utils.toArray<HTMLElement>("[data-card-shell]");
    const row = document.querySelector<HTMLElement>("[data-cards-row]");
    if (!shells.length || !row) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        shells,
        { y: 36, autoAlpha: 0, filter: "blur(10px)" },
        {
          y: 0,
          autoAlpha: 1,
          filter: "blur(0px)",
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.14, // one card after the next, left→right (DOM order)
          clearProps: "filter", // drop the inline entrance blur once crisp
          scrollTrigger: { trigger: row, start: "top 80%", once: true },
        },
      );
    });

    return () => ctx.revert(); // kills the tween + its ScrollTrigger, restores the cards
  }, []);

  return null;
}

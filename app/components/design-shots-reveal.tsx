"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";

// useLayoutEffect on the client (parks/plays before paint, no flash); falls back
// to useEffect during SSR to avoid React's server warning. Mirrors rock-reveal.tsx.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const RING_STAGGER = 0.09; // delay added per ring out from the center
const DURATION = 0.7;
const EASE = "expo.out";

/**
 * On-load entrance for the Designs Shots collage. Renders nothing; on mount it
 * blooms the seven tiles (`[data-shot]`, marked in design-shots.tsx) from the
 * center outward — each scales 0.86 → 1 and fades in, staggered by its ring
 * (`data-shot-ring`) so the center lands first and the symmetric pairs follow.
 *
 * The hidden start state is CSS (`.reveal-armed [data-shot]` in globals.css,
 * armed by the inline script in layout.tsx) so there's no flash before this
 * runs. If the page isn't armed (no-JS) or the user prefers reduced motion we
 * bail and CSS leaves the tiles visible in place. Like rock-reveal.tsx it has no
 * web-font dependency, so it leads the text cascade (visuals first, then copy).
 */
export default function DesignShotsReveal() {
  useIsomorphicLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-hero]");
    if (!root) return;

    const shots = gsap.utils.toArray<HTMLElement>(
      root.querySelectorAll("[data-shot]"),
    );
    if (!shots.length) return;

    if (
      !document.documentElement.classList.contains("reveal-armed") ||
      window.matchMedia(REDUCE_MOTION).matches
    ) {
      return;
    }

    // Pin scale explicitly in `from` so GSAP owns the whole transform (the same
    // matrix-vs-percent reasoning as hero-reveal.tsx / rock-reveal.tsx). The
    // wrapper has no resting transform, so a plain scale resolves cleanly.
    // Function-based stagger turns each tile's ring into its start offset, so a
    // symmetric L/R pair shares one delay and the rings cascade outward.
    const tween = gsap.fromTo(
      shots,
      { scale: 0.86, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: DURATION,
        ease: EASE,
        stagger: (_i, el) =>
          Number((el as HTMLElement).dataset.shotRing ?? 0) * RING_STAGGER,
      },
    );

    return () => {
      tween.kill();
    };
  }, []);

  return null;
}

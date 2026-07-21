"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";

// useLayoutEffect on the client (arm/play before paint, no flash); falls back to
// useEffect during SSR. Mirrors the other *-reveal drivers.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const DURATION = 0.9;
const EASE = "power3.out";

/**
 * Page-chrome on-load reveal for routes that AREN'T the homepage — the top-center
 * wordmark and the floating glass navbar. Renders nothing.
 *
 * WHY THIS EXISTS: the shared layout's synchronous inline script adds
 * `.reveal-armed` to <html> on every route, and globals.css then hides the
 * armed chrome (`.reveal-armed [data-reveal-soft]{opacity:0}` for the navbar,
 * `.reveal-armed [data-reveal]{translateY(110%)}` for the masked wordmark). On
 * the homepage `hero-reveal.tsx` clears those; any other page needs its own
 * driver or the navbar never appears. This is that driver — the interior-page
 * counterpart to HeroReveal, scoped to just the always-in-view top chrome.
 *
 * House rules: rides the shared Lenis/GSAP ticker (one loop), plays once then
 * idles to zero, and leaves the resting state to CSS — under no-JS the class is
 * never added, and under reduced-motion `.reveal-armed` resets to visible (the
 * @media block in globals.css), so this bails in both cases and animates only
 * when armed + motion is allowed.
 */
export default function ChromeReveal() {
  useIsomorphicLayoutEffect(() => {
    if (
      !document.documentElement.classList.contains("reveal-armed") ||
      window.matchMedia(REDUCE_MOTION).matches
    ) {
      return;
    }

    const ctx = gsap.context(() => {
      const marks = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      const nav = document.querySelector<HTMLElement>("[data-reveal-soft]");

      const tl = gsap.timeline({ defaults: { ease: EASE } });

      // Wordmark — masked slide-up out of its overflow-hidden clip. Pin y:0 in
      // the `from` so GSAP owns the full transform: the CSS hidden state
      // (translateY(110%)) computes to a pixel matrix that a yPercent-only tween
      // would leave a fixed `y` baseline behind, freezing the mark (see
      // hero-reveal.tsx for the same lesson).
      if (marks.length) {
        tl.fromTo(
          marks,
          { yPercent: 110, y: 0 },
          { yPercent: 0, duration: DURATION },
          0,
        );
      }

      // Navbar — opacity only, so its -translate-y-1/2 centering survives.
      if (nav) {
        tl.fromTo(nav, { opacity: 0 }, { opacity: 1, duration: DURATION }, 0.1);
      }
    });

    return () => ctx.revert();
  }, []);

  return null;
}

"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";

// useLayoutEffect on the client (parks/plays before paint, no flash); falls back
// to useEffect during SSR to avoid React's server warning. Mirrors hero-reveal.tsx.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const STAGGER = 0.1; // DOM order is left then right → a slight left→right lead

/**
 * On-load rock entrance orchestrator. Renders nothing; on mount it animates the
 * two cliffs (`[data-rock]`, marked in rock.tsx) into place with the "drift"
 * entrance — a soft fade with a small downward settle, the chosen direction.
 *
 * The hidden start state is CSS (`.reveal-armed [data-rock]` in globals.css),
 * so the cliffs are parked in the right place the instant they paint, no flash.
 * If the page isn't armed (no-JS) or the user prefers reduced motion, we bail
 * and CSS leaves the cliffs in place. Independent of hero-reveal.tsx on purpose:
 * the rocks have no web-font dependency, so they settle immediately rather than
 * waiting on fonts — which also makes them lead the text cascade (frame first,
 * then content).
 */
export default function RockReveal() {
  useIsomorphicLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-hero]");
    if (!root) return;

    const rocks = gsap.utils.toArray<HTMLElement>(
      root.querySelectorAll("[data-rock]"),
    );
    if (!rocks.length) return;

    if (
      !document.documentElement.classList.contains("reveal-armed") ||
      window.matchMedia(REDUCE_MOTION).matches
    ) {
      return;
    }

    // Drift — the camera finds them already there: a soft fade with a small
    // downward settle. No clip, no big travel.
    const tween = gsap.fromTo(
      rocks,
      { opacity: 0, y: -10, yPercent: 0 },
      {
        opacity: 1,
        y: 0,
        duration: 1.1,
        ease: "power2.out",
        stagger: STAGGER,
      },
    );

    return () => {
      tween.kill();
    };
  }, []);

  return null;
}

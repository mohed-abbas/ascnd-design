"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { useRockEntrance } from "./rock-entrance";

// useLayoutEffect on the client (parks/plays before paint, no flash); falls back
// to useEffect during SSR to avoid React's server warning. Mirrors hero-reveal.tsx.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const DURATION = 1; // a touch slower than the text — cliffs have mass
const EASE = "expo.out";
const STAGGER = 0.1; // DOM order is left then right → a slight left→right lead

/**
 * On-load rock entrance orchestrator. Renders nothing; on mount it animates the
 * two cliffs (`[data-rock]`, marked in rock.tsx) into place using the entrance
 * direction held in the shared store (`rock-entrance.ts`). Re-plays whenever the
 * mode changes, so a future selector can preview each option live.
 *
 * The hidden start state for the default ("rise") is CSS (`.reveal-armed
 * [data-rock]` in globals.css, armed by the inline script in layout.tsx) so the
 * cliffs are parked below the fold the instant they paint — no flash. If the page
 * isn't armed (no-JS) or the user prefers reduced motion, we bail and CSS leaves
 * the cliffs in place. Independent of hero-reveal.tsx on purpose: the rocks have
 * no web-font dependency, so they rise immediately rather than waiting on fonts —
 * which also makes them lead the text cascade (frame first, then content).
 */
export default function RockReveal() {
  const mode = useRockEntrance();

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

    const ctx = gsap.context(() => {
      switch (mode) {
        case "rise":
        default:
          // Option A — cliffs rise out of the cloud sea. Pin y:0 in `from` so
          // GSAP owns the whole transform: the CSS park state translateY(100%)
          // computes to a pixel matrix, and a yPercent-only tween would leave a
          // frozen y baseline (the gotcha already fixed in hero-reveal.tsx).
          gsap.fromTo(
            rocks,
            { yPercent: 100, y: 0 },
            { yPercent: 0, duration: DURATION, ease: EASE, stagger: STAGGER },
          );
          break;
        // TODO (options B/C): case "slide" → xPercent ±100 from the outer edges;
        //                     case "drift" → opacity 0→1 + a small y drift.
      }
    }, root);

    return () => ctx.revert();
  }, [mode]);

  return null;
}

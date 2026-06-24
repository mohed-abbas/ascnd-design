"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { useRockEntrance } from "./rock-entrance";

// useLayoutEffect on the client (parks/plays before paint, no flash); falls back
// to useEffect during SSR to avoid React's server warning. Mirrors hero-reveal.tsx.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const STAGGER = 0.1; // DOM order is left then right → a slight left→right lead

/**
 * On-load rock entrance orchestrator. Renders nothing; on mount it animates the
 * two cliffs (`[data-rock]`, marked in rock.tsx) into place using the entrance
 * direction held in the shared store (`rock-entrance.ts`). Re-plays whenever the
 * mode changes, so the selector (`rock-entrance-toggle.tsx`) previews each
 * option live.
 *
 * The hidden start state is CSS, keyed per mode on a `.rock-<mode>` class that
 * the inline script in layout.tsx stamps on <html> from the persisted choice
 * (`.reveal-armed.rock-rise [data-rock]` etc. in globals.css) — so the cliffs
 * are parked in the right place the instant they paint, no flash. If the page
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

    let tween: gsap.core.Tween | undefined;

    switch (mode) {
      case "drift":
        // Option C — the camera finds them already there: a soft fade with a
        // small downward settle. No clip, no big travel.
        tween = gsap.fromTo(
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
        break;

      case "rise":
      default:
        // Option A — cliffs rise out of the cloud sea. Pin y:0 in `from` so GSAP
        // owns the whole transform: the CSS park state translateY(100%) computes
        // to a pixel matrix, and a yPercent-only tween would leave a frozen y
        // baseline (the gotcha already fixed in hero-reveal.tsx).
        tween = gsap.fromTo(
          rocks,
          { yPercent: 100, y: 0 },
          { yPercent: 0, duration: 1, ease: "expo.out", stagger: STAGGER },
        );
        break;

      // TODO (option B): case "slide" → xPercent ±100 from the outer edges.
    }

    // Kill (don't revert) on mode change so the next option's fromTo sets its own
    // start state directly — a clean cross-fade between previews, with no detour
    // back through the CSS park position.
    return () => {
      tween?.kill();
    };
  }, [mode]);

  return null;
}

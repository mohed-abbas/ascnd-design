"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { INTRO_REVEAL_EVENT, introWillPlay } from "@/components/sections/intro/intro-state";

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
 * and CSS leaves the cliffs in place.
 *
 * Two entrances, picked by whether the welcome intro is playing:
 *   • Standalone (returning session / no-intro): the "drift" — a soft fade with
 *     a small downward settle. The rocks have no web-font dependency, so they
 *     lead the text cascade (frame first, then content).
 *   • Handing off FROM the intro: the WebGL rocks are the only cliffs on screen
 *     during the welcome (they refract the glass). When the glass docks, <Intro>
 *     fires INTRO_REVEAL_EVENT; we then fade the DOM rocks in OPACITY-ONLY (no
 *     drift) so they land exactly under the static WebGL rocks — an
 *     imperceptible crossfade, one continuous set, no slide and no ghost.
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

    let cancelled = false;
    let tween: gsap.core.Tween | undefined;

    // Standalone drift — the camera finds them already there: a soft fade with a
    // small downward settle. No clip, no big travel.
    const drift = () => {
      if (cancelled) return;
      tween = gsap.fromTo(
        rocks,
        { opacity: 0, y: -10, yPercent: 0 },
        { opacity: 1, y: 0, duration: 1.1, ease: "power2.out", stagger: STAGGER },
      );
    };

    // Intro handoff — opacity-only so the DOM rocks land precisely under the
    // WebGL rocks the canvas is fading out (see component doc). Clear the parked
    // -10px transform up front so the resting position matches what <Intro>
    // measured for the WebGL planes.
    const crossfade = () => {
      if (cancelled) return;
      tween = gsap.fromTo(
        rocks,
        { opacity: 0, y: 0, yPercent: 0 },
        { opacity: 1, duration: 0.35, ease: "power2.out" },
      );
    };

    // While the welcome intro plays, the DOM rocks stay parked until the glass
    // docks (INTRO_REVEAL_EVENT) so the welcome shows only the WebGL rocks.
    let stopWaiting: (() => void) | undefined;
    if (introWillPlay()) {
      const onReveal = () => crossfade();
      window.addEventListener(INTRO_REVEAL_EVENT, onReveal, { once: true });
      stopWaiting = () =>
        window.removeEventListener(INTRO_REVEAL_EVENT, onReveal);
    } else {
      drift();
    }

    return () => {
      cancelled = true;
      stopWaiting?.();
      tween?.kill();
    };
  }, []);

  return null;
}

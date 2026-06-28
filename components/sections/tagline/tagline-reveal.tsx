"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// useLayoutEffect on the client (wires the trigger before paint, no flash);
// falls back to useEffect during SSR. Mirrors the other *-reveal drivers.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// Focus-pull timing.
const DURATION = 1.1;
const EASE = "power2.out";

/**
 * Tagline focus-pull. Renders nothing. The headline rests soft-focused via CSS
 * (`blur-[0.43vw]` in tagline.tsx — that blurred state is the default, so it's
 * what SSR and no-JS show). On scroll, once the section's top crosses the 70%
 * line of the viewport, we tween the blur out to a crisp 0 — a camera pulling
 * focus as the statement comes into view. Scrolling back up reverses it, so the
 * line softens again when it leaves the frame.
 *
 * GSAP reads the *current* computed filter (the `0.43vw` resolved to px) as the
 * tween's start, so the resting blur stays viewport-responsive at load; the
 * tween only ever animates px→px. Reduced-motion users get the crisp headline
 * immediately (no soft resting state they could never scroll out of).
 */
export default function TaglineReveal() {
  useIsomorphicLayoutEffect(() => {
    const line = document.querySelector<HTMLElement>("[data-tagline-line]");
    const section = line?.closest<HTMLElement>("[data-tagline]");
    if (!line || !section) return;

    if (window.matchMedia(REDUCE_MOTION).matches) {
      gsap.set(line, { filter: "blur(0px)" });
      return;
    }

    const tween = gsap.to(line, {
      filter: "blur(0px)",
      duration: DURATION,
      ease: EASE,
      scrollTrigger: {
        trigger: section,
        start: "top 70%", // section top reaches 70% down the viewport
        toggleActions: "play none none reverse",
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return null;
}

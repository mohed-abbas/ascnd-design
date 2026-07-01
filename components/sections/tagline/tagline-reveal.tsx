"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// useLayoutEffect on the client (arms the start state before paint, no flash);
// falls back to useEffect during SSR. Mirrors the other *-reveal drivers.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Per-line offset into the scrubbed timeline (in the tween's 0..1 duration
// units): line 2 starts 0.35 "behind" line 1, so the reveal cascades.
const STAGGER = 0.35;

/**
 * Tagline "supersize" reveal — modelled on air.inc's Supersize Text section.
 * Renders nothing. Each line (see tagline.tsx) is driven by a single per-line
 * CSS var `--p` (0 → 1), animated in globals.css across two channels (the text
 * stays in place): its resting `0.43vw` blur clears to crisp, and a full-white
 * clone is wiped in bottom→top over the dim base via a progress-driven gradient
 * mask.
 *
 * The reveal is SCRUBBED: `--p` is tied directly to scroll position, so it
 * plays as the section enters and reverses as it leaves — no fixed duration.
 * Because `scrub` reads the true scroll position, a load parked mid-section
 * resolves to the correct progress with no "plays on load" flash (the pitfall
 * `toggleActions` had), so no explicit onEnter/onLeaveBack callbacks are needed.
 *
 * ScrollTrigger updates are already pumped by the global Lenis instance and its
 * rAF runs off gsap.ticker (lenis-provider.tsx) — one loop, no competing
 * scheduler — so the scrub is Lenis-smooth for free.
 *
 * Resting state: `--p` defaults to 1 in CSS, so SSR / no-JS / reduced-motion
 * render the finished headline. When motion is allowed we arm `--p` to 0 in a
 * layout effect (before paint) and let the scrub take over. `gsap.matchMedia`
 * handles the reduced-motion branch and reverts everything on unmount.
 */
export default function TaglineReveal() {
  useIsomorphicLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-tagline]");
    const lines = gsap.utils.toArray<HTMLElement>("[data-trise]");
    if (!section || !lines.length) return;

    const mm = gsap.matchMedia();

    // Reduced motion: leave the headline in its finished resting state.
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(lines, { "--p": 1 });
    });

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Arm the start before paint (default CSS --p:1 keeps SSR/no-JS full).
      gsap.set(lines, { "--p": 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top 65%", // begins as the section top passes 65% of the vh
          end: "top -10%", // finishes just after the top clears the viewport
          scrub: 0.5, // light smoothing on top of Lenis
          invalidateOnRefresh: true, // re-measure on resize (vw-based sizing)
        },
      });

      lines.forEach((line, i) =>
        tl.fromTo(
          line,
          { "--p": 0 },
          { "--p": 1, ease: "none", duration: 1 },
          i * STAGGER,
        ),
      );
    });

    return () => mm.revert();
  }, []);

  return null;
}

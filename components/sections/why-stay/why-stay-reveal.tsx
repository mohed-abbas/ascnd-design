"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PHRASES, REEL_STEP } from "./why-stay-data";

gsap.registerPlugin(ScrollTrigger);

// useLayoutEffect on the client (arms the start state before paint, no flash);
// falls back to useEffect during SSR. Mirrors the other *-reveal drivers.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// ── Scroll range (tune live) ────────────────────────────────────────────────
const START = "top 85%"; // begins as the section top passes 85% of the viewport
const END = "bottom 30%"; // completes while the section bottom is still 30% up
const SCRUB = 0.5; // light smoothing on top of Lenis

// ── Timeline proportions (scrubbed → only the ratios matter) ────────────────
const HEAD_DUR = 0.6; // per-character roll-up duration
const HEAD_STAGGER = 0.05; // gap between heading characters
const PILL_DUR = 0.7; // pill + lens fade-in
const ENTER = 0.7; // first phrase rolling into the pill
const ROLL = 0.55; // each phrase→next roll
const HOLD = 1.15; // dwell on each phrase (reading time)
const ROLL_EASE = "power3.out";

/**
 * "why teams stay" scrubbed orchestrator. Renders nothing. On mount it builds one
 * scroll-scrubbed timeline over the section:
 *   1. the heading rolls up per character + the glass pill / lens fade in, then
 *   2. the reel cycles through every phrase — a quick `power3.out` roll into the
 *      pill, then a dwell so it can be read — by animating a single inherited
 *      `--reel-y` (px) that both the base and lens columns translate by.
 *
 * SCRUBBED: `--reel-y` is tied to scroll position, so it plays forward as the
 * section enters and reverses as it leaves, with no fixed duration. Because
 * `scrub` reads the true scroll position, a load parked mid-section resolves to
 * the correct progress with no on-load flash.
 *
 * Resting state: CSS defaults `--reel-y` to 0 (first phrase centred) and leaves
 * the heading / pill / lens visible, so SSR / no-JS / reduced-motion render a
 * legible, static section. `gsap.matchMedia` arms the hidden start only under
 * `no-preference` and reverts everything on unmount. ScrollTrigger updates are
 * already pumped by the global Lenis rAF (lenis-provider.tsx) — one loop.
 */
export default function WhyStayReveal() {
  useIsomorphicLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-whystay]");
    if (!section) return;

    const stage = section.querySelector<HTMLElement>("[data-whystay-stage]");
    const pill = section.querySelector<HTMLElement>("[data-whystay-pill]");
    const chars = gsap.utils.toArray<HTMLElement>("[data-whschar]");
    if (!stage) return;

    const N = PHRASES.length;
    const mm = gsap.matchMedia();

    // Reduced motion: first phrase centred, everything at rest (--reel-y:0 is the
    // CSS default; set it explicitly so a mid-section load can't inherit a stale
    // armed value from a prior no-preference mount).
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(stage, { "--reel-y": "0px" });
    });

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Arm the hidden start before paint: reel parked one step low (pill empty),
      // heading glyphs below their clips, pill + lens invisible.
      gsap.set(stage, { "--reel-y": `${REEL_STEP}px` });
      if (chars.length) gsap.set(chars, { yPercent: 110 });
      if (pill) gsap.set(pill, { autoAlpha: 0, scale: 0.96 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: START,
          end: END,
          scrub: SCRUB,
          invalidateOnRefresh: true,
        },
      });

      // Intro — the glass pill fades/scales in while the heading rolls up (at 0).
      if (pill)
        tl.to(pill, { autoAlpha: 1, scale: 1, duration: PILL_DUR, ease: "power2.out" }, 0);
      if (chars.length)
        tl.to(
          chars,
          { yPercent: 0, duration: HEAD_DUR, ease: ROLL_EASE, stagger: HEAD_STAGGER },
          0,
        );

      // Reel — starts just after the heading settles. First phrase rolls in, then
      // each subsequent phrase after a dwell (the `+=HOLD` gap is the reading beat).
      const headEnd = HEAD_DUR + HEAD_STAGGER * chars.length;
      tl.to(stage, { "--reel-y": "0px", duration: ENTER, ease: ROLL_EASE }, headEnd + 0.25);
      for (let i = 1; i < N; i++) {
        tl.to(
          stage,
          { "--reel-y": `${-i * REEL_STEP}px`, duration: ROLL, ease: ROLL_EASE },
          `+=${HOLD}`,
        );
      }
      // Trailing dwell so the last phrase rests centred through the end of the scrub.
      tl.to({}, { duration: HOLD });
    });

    return () => mm.revert();
  }, []);

  return null;
}

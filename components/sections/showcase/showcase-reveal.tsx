"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// useLayoutEffect on the client (arms the start state before paint, no flash);
// falls back to useEffect during SSR. Mirrors the other *-reveal drivers.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// ── Trigger ──────────────────────────────────────────────────────────────────
// PLAY-ON-ENTER, not scrubbed. This section is the LAST on the page and fills one
// viewport, so the heading (which sits low in it) only ever rises to ~75% of the
// viewport at max scroll — a scrubbed reveal could never reach 100% because the
// page can't scroll far enough. A self-timed play when the heading enters view
// sidesteps that entirely (and reads as a proper "loading" reveal). Replays each
// time the heading re-enters; reverses when scrolled back up out.
const START = "top 88%"; // heading top passes 88% of the vh → play
const TOGGLE = "play none none reverse";

// ── Per-word blur-rise (identical to why-stay's heading) ─────────────────────
const RISE = 40; // yPercent each word starts below its resting line
const BLUR_FROM = "blur(8px)";
const BLUR_TO = "blur(0px)";
const DUR = 0.6; // per-word settle
const STAGGER = 0.1; // gap between words
const EASE = "power3.out";

/**
 * Heading reveal for the showcase — "stuff we've shipped". Renders nothing.
 *
 * As the heading scrolls into view, each word rises from below, fades in, and
 * clears from a soft blur, cascading left→right. This is the SAME mechanic as the
 * why-stay heading (the stylistic sibling: 49px / light / Instrument-Serif accent),
 * so the two read as one family.
 *
 * PLAY-ON-ENTER (time-based): the reveal plays itself over ~0.8s when the heading
 * scrolls into view — required because the section is at the page bottom with too
 * little scroll room for a scrub to complete (see the TOGGLE note above).
 * ScrollTrigger.update is pumped by the global Lenis rAF (lenis-provider.tsx).
 *
 * Resting state: the words render fully visible by default, so SSR / no-JS /
 * reduced-motion show the finished heading. Only under no-preference do we arm the
 * hidden start (before paint) and let the play-on-enter trigger drive it.
 * `gsap.matchMedia` reverts everything on unmount.
 *
 * (The CTA below the heading is intentionally untouched for now — the button is
 * the next task.)
 */
export default function ShowcaseReveal() {
  useIsomorphicLayoutEffect(() => {
    const heading = document.querySelector<HTMLElement>(
      "[data-showcase-heading]",
    );
    const words = gsap.utils.toArray<HTMLElement>("[data-showcase-word]");
    if (!heading || !words.length) return;

    const mm = gsap.matchMedia();

    // Reduced motion: heading fully formed, no reveal. Set explicitly so a prior
    // no-preference mount can't leave a stale armed value.
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(words, { yPercent: 0, autoAlpha: 1, filter: BLUR_TO });
    });

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Arm the hidden start before paint: words dropped + faded + blurred.
      gsap.set(words, { yPercent: RISE, autoAlpha: 0, filter: BLUR_FROM });

      gsap.to(words, {
        yPercent: 0,
        autoAlpha: 1,
        filter: BLUR_TO,
        duration: DUR,
        ease: EASE,
        stagger: STAGGER,
        scrollTrigger: {
          trigger: heading,
          start: START,
          toggleActions: TOGGLE,
          invalidateOnRefresh: true,
        },
      });
    });

    return () => mm.revert();
  }, []);

  return null;
}

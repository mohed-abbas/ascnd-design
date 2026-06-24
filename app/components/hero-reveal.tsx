"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

// useLayoutEffect on the client (runs before paint, so SplitText's line-parking
// happens with no flash); falls back to useEffect during SSR to avoid React's
// "useLayoutEffect does nothing on the server" warning.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const STAGGER = 0.12; // gap between blocks in the cascade
const DURATION = 0.7;
const EASE = "expo.out";

/**
 * On-load reveal orchestrator. Renders nothing; on mount it builds a single
 * staggered GSAP timeline that slides the hero's text up into place.
 *
 * Blocks are marked declaratively in the components (no prop-drilling):
 *   [data-reveal]        masked slide-up (lives in an overflow:hidden wrapper)
 *   [data-reveal-fade]   fade + small slide (chrome / the mask-image logos row)
 *   [data-reveal-split]  the headline — SplitText splits it into masked lines
 * Cascade order comes from each element's `data-reveal-order`.
 *
 * The hidden start state is CSS (`.reveal-armed` in globals.css, armed by the
 * inline script in layout.tsx) so there's no flash before this runs. If the page
 * isn't armed (no-JS) or the user prefers reduced motion, we bail out and CSS
 * leaves everything visible. Mirrors the reduced-motion gate in cloud-layer.tsx.
 */
export default function HeroReveal() {
  useIsomorphicLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-hero]");
    if (!root) return;

    if (
      !document.documentElement.classList.contains("reveal-armed") ||
      window.matchMedia(REDUCE_MOTION).matches
    ) {
      return;
    }

    let split: SplitText | undefined;
    let ctx: gsap.Context | undefined;
    let cancelled = false;

    const build = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
      type Entry = {
        order: number;
        add: (tl: gsap.core.Timeline, at: number) => void;
      };
      const entries: Entry[] = [];

      // Every block uses fromTo with EXPLICIT start values for both yPercent
      // and y. The CSS hidden state (`.reveal-armed [data-reveal]{transform:
      // translateY(110%)}`) computes to a pixel matrix; if we only animate
      // yPercent, GSAP parses that matrix into a fixed `y` baseline (~62.7px)
      // that the yPercent tween never clears, freezing the block. Pinning y:0
      // in `from` makes GSAP own the full transform, so it resolves to identity.

      // Headline → masked lines via SplitText; they rise line-by-line.
      const headline = root.querySelector<HTMLElement>("[data-reveal-split]");
      if (headline) {
        split = new SplitText(headline, { type: "lines", mask: "lines" });
        gsap.set(headline, { opacity: 1 }); // opacity is unit-safe to set
        const lines = split.lines;
        entries.push({
          order: Number(headline.dataset.revealOrder ?? 0),
          add: (tl, at) =>
            tl.fromTo(
              lines,
              { yPercent: 110, y: 0 },
              { yPercent: 0, duration: DURATION, ease: EASE, stagger: 0.08 },
              at,
            ),
        });
      }

      // Masked blocks — slide up from below their overflow:hidden wrapper.
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        entries.push({
          order: Number(el.dataset.revealOrder ?? 0),
          add: (tl, at) =>
            tl.fromTo(
              el,
              { yPercent: 110, y: 0 },
              { yPercent: 0, duration: DURATION, ease: EASE },
              at,
            ),
        });
      });

      // Fade blocks — opacity + a small lift (no hard clip).
      root.querySelectorAll<HTMLElement>("[data-reveal-fade]").forEach((el) => {
        entries.push({
          order: Number(el.dataset.revealOrder ?? 0),
          add: (tl, at) =>
            tl.fromTo(
              el,
              { opacity: 0, y: 16 },
              { opacity: 1, y: 0, duration: DURATION, ease: EASE },
              at,
            ),
        });
      });

      // Soft blocks — opacity only. No transform touched, so the navbar keeps
      // its own translate-based centering.
      root.querySelectorAll<HTMLElement>("[data-reveal-soft]").forEach((el) => {
        entries.push({
          order: Number(el.dataset.revealOrder ?? 0),
          add: (tl, at) =>
            tl.fromTo(
              el,
              { opacity: 0 },
              { opacity: 1, duration: DURATION, ease: EASE },
              at,
            ),
        });
      });

      entries.sort((a, b) => a.order - b.order);

      const tl = gsap.timeline({ defaults: { ease: EASE } });
      entries.forEach((entry, i) => entry.add(tl, i * STAGGER));
      }, root);
    };

    // Defer until web fonts are ready: SplitText must measure line breaks with
    // the real Product Sans, or the masked lines reflow (mis-clip) on font swap.
    // Everything stays hidden via `.reveal-armed` until then, so there's no
    // visual cost to waiting.
    if (!document.fonts || document.fonts.status === "loaded") {
      build();
    } else {
      document.fonts.ready.then(build);
    }

    return () => {
      cancelled = true;
      ctx?.revert(); // restores inline styles set above
      split?.revert(); // unwraps SplitText line/mask markup
    };
  }, []);

  return null;
}

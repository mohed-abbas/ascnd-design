"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { INTRO_REVEAL_EVENT, introWillPlay } from "@/components/sections/intro/intro-state";

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
// The per-unit roll-up ease (headline words, sub-paragraph words, CTAs) — the
// same smooth settle as the tagline roll-up.
const ROLL_EASE = "power3.out";
// Word reveal: each word rises a little, fades in, and clears from a soft blur
// to crisp — a blur reveal, word by word (replacing the old per-character roll).
// No overflow mask here (a hard clip would shear the blur halo); the rise is
// small and the fade + un-blur carry the entrance instead.
const WORD_RISE = 40; // yPercent each word starts below its resting line
const WORD_STAGGER = 0.06; // gap between headline words
const BODY_STAGGER = 0.03; // gap between sub-paragraph words (there are more)
const BLUR_FROM = "blur(8px)";
const BLUR_TO = "blur(0px)";

/**
 * On-load reveal orchestrator. Renders nothing; on mount it builds a single
 * staggered GSAP timeline that slides the hero's text up into place.
 *
 * Blocks are marked declaratively in the components (no prop-drilling):
 *   [data-reveal]        masked slide-up (lives in an overflow:hidden wrapper)
 *   [data-reveal-fade]   fade + small slide (chrome / the mask-image logos row)
 *   [data-reveal-soft]   opacity only (the navbar, whose translate must survive)
 *   [data-reveal-split]  the headline — SplitText blur-reveals it word by word
 *   [data-reveal-words]  the sub-paragraph — same per-word blur reveal
 *   [data-reveal-cta]    a button — the inner control fades in (opacity only,
 *                        so hover scale / glow / focus ring aren't shaved)
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

    const splits: SplitText[] = [];
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

      // Headline → per-word blur reveal via SplitText (words, no mask): each
      // word rises a touch, fades in, and clears from a soft blur to crisp,
      // staggered word by word.
      const headline = root.querySelector<HTMLElement>("[data-reveal-split]");
      if (headline) {
        const s = new SplitText(headline, { type: "words" });
        splits.push(s);
        gsap.set(headline, { opacity: 1 }); // opacity is unit-safe to set
        entries.push({
          order: Number(headline.dataset.revealOrder ?? 0),
          add: (tl, at) =>
            tl.fromTo(
              s.words,
              { yPercent: WORD_RISE, autoAlpha: 0, filter: BLUR_FROM },
              {
                yPercent: 0,
                autoAlpha: 1,
                filter: BLUR_TO,
                duration: DURATION,
                ease: ROLL_EASE,
                stagger: WORD_STAGGER,
                clearProps: "filter", // drop the inline filter once crisp
              },
              at,
            ),
        });
      }

      // Sub-paragraph → the same per-word blur reveal, a touch tighter (more
      // words), so it reads as one continuation of the headline's cascade.
      const bodyText = root.querySelector<HTMLElement>("[data-reveal-words]");
      if (bodyText) {
        const s = new SplitText(bodyText, { type: "words" });
        splits.push(s);
        gsap.set(bodyText, { opacity: 1 });
        entries.push({
          order: Number(bodyText.dataset.revealOrder ?? 0),
          add: (tl, at) =>
            tl.fromTo(
              s.words,
              { yPercent: WORD_RISE, autoAlpha: 0, filter: BLUR_FROM },
              {
                yPercent: 0,
                autoAlpha: 1,
                filter: BLUR_TO,
                duration: DURATION,
                ease: ROLL_EASE,
                stagger: BODY_STAGGER,
                clearProps: "filter",
              },
              at,
            ),
        });
      }

      // When the welcome intro is handing off, the glass "ascnd" docks onto the
      // wordmark slot and crossfades into it — <Intro> owns that fade, synced to
      // the glass fade-out, so the wordmark must stay hidden here (no slide-up,
      // never shown through the transmissive glass). Skip it entirely; the
      // masked slide-up still runs for returning sessions.
      const introHandoff = introWillPlay();

      // Masked blocks — slide up from below their overflow:hidden wrapper.
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        if (introHandoff && el.closest("[data-wordmark-slot]")) return;
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

      // CTAs → fade in (no slide, no clip). The inner control starts at
      // opacity:0 (globals.css) and fades up, staggered per button. A plain
      // opacity tween leaves the transform untouched, so the hover scale / glow
      // and focus ring are never shaved.
      const ctaWraps = Array.from(
        root.querySelectorAll<HTMLElement>("[data-reveal-cta]"),
      );
      if (ctaWraps.length) {
        const btns = ctaWraps
          .map((w) => w.firstElementChild)
          .filter(Boolean) as HTMLElement[];
        entries.push({
          order: Number(ctaWraps[0].dataset.revealOrder ?? 0),
          add: (tl, at) =>
            tl.fromTo(
              btns,
              { opacity: 0 },
              {
                opacity: 1,
                duration: DURATION,
                ease: EASE,
                stagger: 0.08,
              },
              at,
            ),
        });
      }

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
    const start = () => {
      if (cancelled) return;
      if (!document.fonts || document.fonts.status === "loaded") {
        build();
      } else {
        document.fonts.ready.then(build);
      }
    };

    // When the welcome intro is playing, the hero stays parked until the glass
    // "ascnd" docks — <Intro> fires INTRO_REVEAL_EVENT ~⅔ through the dock, and
    // the cascade then rises in as the glass hands off to the real wordmark.
    // Otherwise (returning session / reduced-motion / no-intro) reveal at once.
    let stopWaiting: (() => void) | undefined;
    if (introWillPlay()) {
      const onReveal = () => start();
      window.addEventListener(INTRO_REVEAL_EVENT, onReveal, { once: true });
      stopWaiting = () =>
        window.removeEventListener(INTRO_REVEAL_EVENT, onReveal);
    } else {
      start();
    }

    return () => {
      cancelled = true;
      stopWaiting?.();
      ctx?.revert(); // restores inline styles set above
      splits.forEach((s) => s.revert()); // unwraps SplitText char/word markup
    };
  }, []);

  return null;
}

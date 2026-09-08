"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { WORDMARK_FX_ID } from "./wordmark-fx";

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

/* The Figma comp's own numbers (node 918:438), and the width they were authored
   against — the V4 column cap, which is also the wordmark's ink width there.
   Both are in CSS pixels, so both are rescaled per viewport below. */
const DESIGN_WIDTH = 1197;
const DESIGN_BASE_FREQUENCY = 0.028901735320687294; // ≈ 35px noise features
const DESIGN_SCALE = 51; // ±25.5px of displacement at full strength

const FADE_IN = 0.35;
const FADE_OUT = 0.45;

/* Candle flicker. Three slow sines at deliberately incommensurate rates, so the
   sum never repeats on any period a viewer could notice — that irregularity is
   what separates "a flame" from "a pulse". Rates are in radians/sec: 0.18Hz,
   0.30Hz and 0.49Hz, all well under one cycle a second. Amplitudes stack to
   ±0.30, so the distortion breathes between ~0.7× and ~1.3× of full rather than
   guttering out. A fourth, much slower sine drifts the noise FREQUENCY, which
   swells and shrinks the ragged features themselves — without it the letter
   pulses in and out at a fixed shape and reads mechanical. */
const FLICKER = [
  { rate: 1.1, phase: 0, amp: 0.16 },
  { rate: 1.9, phase: 1.3, amp: 0.09 },
  { rate: 3.1, phase: 0.7, amp: 0.05 },
] as const;
const BREATH_RATE = 0.8;
const BREATH_AMP = 0.1;

/**
 * Drives the footer wordmark's per-letter distortion. Renders nothing.
 *
 * The letter under the pointer dissolves into the Figma texture and flickers
 * there like candlelight; every other letter stays crisp. Only the letter's own
 * `scale` is animated — at 0 the displacement map is a no-op and the glyph is
 * ordinary text, so there is no second copy of the wordmark anywhere and
 * nothing is masked or stacked.
 *
 * WHY THE POINTER IS TRACKED ON THE FOOTER, NOT THE LETTERS: the wordmark is
 * pointer-events-none and must stay that way — at ~461px with leading-none its
 * box overlaps the nav and legal rows above it and, being later in DOM order,
 * took every click on them (see the note in footer.tsx). Giving the letters
 * their own hit areas would reintroduce exactly that. So there is no
 * pointerenter to listen for: we hit-test coordinates against each letter's
 * box instead. Vertically that box is the wordmark's MARGIN box, not its border
 * box — the ink-trimming margins are negative, so they shrink 461px of line box
 * to the 338px the letters actually occupy, and using the border box would arm
 * the effect from empty air well above and below the word.
 *
 * COST: an animated `scale` re-runs the displacement every frame, so a hovered
 * letter is genuinely repainting. It is bounded — one letter, only while
 * hovered, and the ticker is dropped the moment the last letter reaches 0, at
 * which point the filter is removed from the span entirely rather than left
 * running as a no-op. Idle cost is therefore zero, not "cheap". Not yet wired
 * to lib/perf/tiers.ts; that is the follow-up per the feature-first convention.
 *
 * Mouse-only (no hover on touch) and disabled under prefers-reduced-motion,
 * where the letters simply stay crisp.
 */
export default function WordmarkTexture() {
  useEffect(() => {
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const footer = document.querySelector<HTMLElement>("[data-footer]");
    const word = document.querySelector<HTMLElement>("[data-footer-wordmark]");
    if (!footer || !word) return;

    const letters = Array.from(
      word.querySelectorAll<HTMLElement>("[data-fx-letter]"),
    );
    const turbulences = letters.map((_, i) =>
      document.querySelector<SVGElement>(`#${WORDMARK_FX_ID}-${i} feTurbulence`),
    );
    const displacements = letters.map((_, i) =>
      document.querySelector<SVGElement>(`#${WORDMARK_FX_ID}-${i} feDisplacementMap`),
    );
    if (!letters.length || turbulences.some((n) => !n)) return;
    if (displacements.some((n) => !n)) return;

    // How distorted each letter currently is, 0 → 1. Tweened, then read every
    // frame by the flicker.
    const amounts = letters.map(() => ({ v: 0 }));
    const filtered = letters.map(() => false);
    let hovered = -1;
    let running = false;

    /* baseFrequency and scale are in CSS pixels, but the wordmark is fluid
       (38.574cqw). Left alone the noise would keep a fixed 35px grain while the
       letters shrank, so the texture would read coarser and coarser below the
       1197px cap. Rescale both by the same ratio so the effect is the design's
       at every width. */
    let scale = DESIGN_SCALE;
    let frequency = DESIGN_BASE_FREQUENCY;
    // The ink-trimming margins, cached. Both are negative, so subtracting the
    // top and adding the bottom walks the border box's edges INWARD onto the ink
    // (see the header note). Read here rather than per pointermove:
    // getComputedStyle forces a style recalc, and these only move when the
    // wordmark resizes — which is exactly when this runs.
    let trimTop = 0;
    let trimBottom = 0;
    const syncScale = () => {
      const width = word.getBoundingClientRect().width;
      if (!width) return;
      const k = width / DESIGN_WIDTH;
      scale = DESIGN_SCALE * k;
      frequency = DESIGN_BASE_FREQUENCY / k;
      const style = getComputedStyle(word);
      trimTop = parseFloat(style.marginTop) || 0;
      trimBottom = parseFloat(style.marginBottom) || 0;
    };

    const tick = (time: number) => {
      let alive = false;
      const flicker =
        1 +
        FLICKER.reduce(
          (sum, w) => sum + w.amp * Math.sin(time * w.rate + w.phase),
          0,
        );
      const breath = frequency * (1 + BREATH_AMP * Math.sin(time * BREATH_RATE));

      for (let i = 0; i < letters.length; i++) {
        const amount = amounts[i].v;
        if (amount <= 0.001) {
          // Strip the filter entirely rather than leave a scale=0 no-op in
          // place: an idle letter should cost nothing at all.
          if (filtered[i]) {
            letters[i].style.filter = "";
            filtered[i] = false;
          }
          continue;
        }
        alive = true;
        if (!filtered[i]) {
          letters[i].style.filter = `url(#${WORDMARK_FX_ID}-${i})`;
          filtered[i] = true;
        }
        displacements[i]?.setAttribute("scale", `${scale * amount * flicker}`);
        turbulences[i]?.setAttribute("baseFrequency", `${breath} ${breath}`);
      }

      if (!alive) stop();
    };

    const start = () => {
      if (running) return;
      running = true;
      gsap.ticker.add(tick);
    };
    function stop() {
      if (!running) return;
      running = false;
      gsap.ticker.remove(tick);
    }

    // Raise the named letter, lower every other one. Passing -1 lowers all.
    const setHovered = (next: number) => {
      if (next === hovered) return;
      hovered = next;
      amounts.forEach((amount, i) => {
        const to = i === next ? 1 : 0;
        if (amount.v === to) return;
        gsap.to(amount, {
          v: to,
          duration: to ? FADE_IN : FADE_OUT,
          ease: to ? "power2.out" : "power2.inOut",
          overwrite: true,
        });
      });
      if (next >= 0) start();
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;

      const box = word.getBoundingClientRect();
      if (e.clientY < box.top - trimTop || e.clientY > box.bottom + trimBottom) {
        setHovered(-1);
        return;
      }

      const hit = letters.findIndex((letter) => {
        const rect = letter.getBoundingClientRect();
        return e.clientX >= rect.left && e.clientX <= rect.right;
      });
      setHovered(hit);
    };

    const onLeave = () => setHovered(-1);

    syncScale();
    const observer = new ResizeObserver(syncScale);
    observer.observe(word);

    footer.addEventListener("pointermove", onMove);
    footer.addEventListener("pointerleave", onLeave);

    return () => {
      observer.disconnect();
      footer.removeEventListener("pointermove", onMove);
      footer.removeEventListener("pointerleave", onLeave);
      amounts.forEach((amount) => gsap.killTweensOf(amount));
      letters.forEach((letter) => (letter.style.filter = ""));
      stop();
    };
  }, []);

  return null;
}

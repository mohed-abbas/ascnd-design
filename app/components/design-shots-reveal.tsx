"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { SHOT_ARC_SLOTS, SHOT_BASE } from "./design-shots";

// useLayoutEffect on the client (parks/plays before paint, no flash); falls back
// to useEffect during SSR to avoid React's server warning. Mirrors rock-reveal.tsx.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// ── Bloom (entrance) ──
const BLOOM_DURATION = 0.7;
const BLOOM_EASE = "expo.out";
const RING_STAGGER = 0.09; // delay added per ring out from the center

// ── Rotation (steady state) ──
const SLOT_TIME = 5; // seconds for a tile to advance one slot
const N = SHOT_ARC_SLOTS.length; // 7 slots in the loop
const REVOLUTION = SLOT_TIME * N; // full loop time (constant speed)
const FADE_IN = 0.6; // ease the corner tiles from full → their steady value at start
const EDGE_FADE = 0.25; // slots over which a tile fades in/out at the far corners

// Closed Catmull-Rom through a numeric ring — smooth (no corners) everywhere,
// including the seam, so motion never stutters. t is in [0, n).
function crClosed(arr: number[], t: number): number {
  const n = arr.length;
  const i = Math.floor(t);
  const f = t - i;
  const a0 = arr[(i - 1 + n) % n];
  const a1 = arr[i % n];
  const a2 = arr[(i + 1) % n];
  const a3 = arr[(i + 2) % n];
  return (
    0.5 *
    (2 * a1 +
      (-a0 + a2) * f +
      (2 * a0 - 5 * a1 + 4 * a2 - a3) * f * f +
      (-a0 + 3 * a1 - 3 * a2 + a3) * f * f * f)
  );
}

/**
 * Designs Shots collage motion. Renders nothing. On mount it (1) blooms the
 * seven tiles in from the center outward, then (2) hands off to an infinite,
 * constant-speed rotation that slides each tile one slot at a time along the
 * arc — growing into the big center slot and shrinking back out to the edges,
 * with the far-right tile wrapping back to the far-left.
 *
 * Size belongs to the slot, not the tile (so the whole thing reads as a turning
 * wheel): a closed Catmull-Rom over the seven arc slots gives a smooth path +
 * scale. A tile is only visible on the front arc (slots 0..6); it fades out as
 * it reaches the far-right corner and stays fully hidden across the entire
 * over-the-top return, so nothing is ever seen sliding back to far-left — it
 * simply reappears (fades in) at the far-left corner. Mirror/radius stay with
 * each tile (no flip). The hidden start state is CSS (`.reveal-armed
 * [data-shot]`); no-JS / reduced-motion leave the tiles in their resting arc.
 * Like rock-reveal.tsx it has no font dependency.
 */
export default function DesignShotsReveal() {
  useIsomorphicLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-hero]");
    if (!root) return;

    const rotors = gsap.utils.toArray<HTMLElement>(
      root.querySelectorAll("[data-shot-rotor]"),
    );
    const shots = root.querySelectorAll<HTMLElement>("[data-shot]"); // bloomers
    if (!rotors.length) return;

    if (
      !document.documentElement.classList.contains("reveal-armed") ||
      window.matchMedia(REDUCE_MOTION).matches
    ) {
      return;
    }

    let cancelled = false;
    const tweens: gsap.core.Tween[] = [];

    const xs = SHOT_ARC_SLOTS.map((s) => s.x);
    const ys = SHOT_ARC_SLOTS.map((s) => s.y);
    const sizes = SHOT_ARC_SLOTS.map((s) => s.size);

    // Place every rotor for the current loop phase `p` (0..1). `fade` blends the
    // resting opacity (1, where the bloom left off) into the rotation's steady
    // opacity so the far tiles ease to translucent instead of popping.
    const state = { p: 0, fade: 0 };
    function render() {
      rotors.forEach((el) => {
        const arc = Number(el.dataset.arc ?? 0);
        const s = ((state.p + arc / N) % 1) * N; // phase in [0, N)
        // Visible only on the front arc (slots 0..6), fading quickly at the far
        // corners; fully hidden across the over-the-top return (s > 6) so no
        // ghost slides back to far-left.
        const steady = s <= 6 ? gsap.utils.clamp(0, 1, Math.min(s, 6 - s) / EDGE_FADE) : 0;
        gsap.set(el, {
          x: crClosed(xs, s),
          y: crClosed(ys, s),
          scale: crClosed(sizes, s) / SHOT_BASE,
          opacity: gsap.utils.interpolate(1, steady, state.fade),
        });
      });
    }

    function startRotation() {
      if (cancelled) return;
      // p loops forever at constant speed (ease none) → seamless. At p=0 every
      // tile sits exactly on its slot (Catmull-Rom passes through the points),
      // matching where the bloom ended, so the handoff has no jump.
      tweens.push(
        gsap.to(state, {
          p: 1,
          duration: REVOLUTION,
          ease: "none",
          repeat: -1,
          onUpdate: render,
        }),
      );
      // One-shot fade (not derived from the looping p, so it never resets at the
      // loop seam) to settle the far tiles to their translucent value.
      tweens.push(gsap.to(state, { fade: 1, duration: FADE_IN, ease: "power1.inOut" }));
    }

    // Bloom from the center outward (scale + opacity on the inner wrapper), then
    // hand off to the rotation.
    tweens.push(
      gsap.fromTo(
        shots,
        { scale: 0.86, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: BLOOM_DURATION,
          ease: BLOOM_EASE,
          stagger: (_i, el) =>
            Number((el as HTMLElement).dataset.shotRing ?? 0) * RING_STAGGER,
          onComplete: startRotation,
        },
      ),
    );

    return () => {
      cancelled = true;
      tweens.forEach((t) => t.kill());
    };
  }, []);

  return null;
}

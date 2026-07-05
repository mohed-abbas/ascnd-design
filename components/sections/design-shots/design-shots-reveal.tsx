"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { SHOT_ARC_SLOTS, SHOT_BASE } from "./shots-spec";
import {
  INTRO_LAST_RESORT_MS,
  INTRO_REVEAL_EVENT,
  INTRO_START_EVENT,
  introWillPlay,
} from "@/components/sections/intro/intro-state";

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
const N = SHOT_ARC_SLOTS.length; // 8 slots: 7 visible (0..6) + 1 off-screen return (7)
const FRONT = N - 2; // last visible slot index (far-R = 6); slot 7 is the return
const REVOLUTION = SLOT_TIME * N; // full loop time (constant speed)
const FADE_IN = 0.6; // ease in the steady opacity at the bloom→rotation handoff
const EDGE_FADE = 0.35; // slots over which a tile fades out/in as it crosses off-screen

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
 * wheel): a closed Catmull-Rom over the arc slots gives a smooth path + scale.
 * It's a true conveyor — eight slots for seven visible positions, so one tile
 * is always travelling the hidden off-screen return (far-R → over the top →
 * far-L) while all seven visible slots stay filled. No gap, no ghost: a tile
 * fades out just past far-R as it leaves the frame and fades back in just
 * before far-L. The eighth tile (the in-transit one) is its own unique shot, so
 * no image ever repeats on the conveyor. Mirror/radius stay with each tile (no
 * flip). The hidden start state is CSS
 * (`.reveal-armed [data-shot]`); no-JS / reduced-motion leave the tiles in
 * their resting arc. Like rock-reveal.tsx it has no font dependency.
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

    // Cache each rotor's arc once — it was re-read from the dataset and
    // string-parsed on every rotor on every frame.
    const arcs = rotors.map((el) => Number(el.dataset.arc ?? 0));

    // Place every rotor for the current loop phase `p` (0..1). `fade` blends the
    // resting opacity (1, where the bloom left off) into the rotation's steady
    // opacity so the far tiles ease to translucent instead of popping.
    const state = { p: 0, fade: 0 };
    function render() {
      for (let i = 0; i < rotors.length; i++) {
        const el = rotors[i];
        const s = ((state.p + arcs[i] / N) % 1) * N; // this rotor's phase in [0, N)
        // Fully visible across the entire front arc (slots 0..6 = far-L..far-R),
        // matching the static design where all seven tiles are solid. Only the
        // off-screen return leg (s in (6, 8)) is hidden: fade out just past
        // far-R as the tile leaves the frame, stay invisible across the top,
        // fade back in just before far-L. The fades happen off-screen, so the
        // wrap is seamless — a tile disappears at far-R and reappears at far-L
        // with no ghost and no empty slot.
        let steady: number;
        if (s <= FRONT) {
          steady = 1;
        } else {
          const t = s - FRONT; // 0..(N-FRONT) along the return leg
          const span = N - FRONT; // total return length in slot units (2)
          steady =
            t < EDGE_FADE
              ? 1 - t / EDGE_FADE // fade out leaving far-R
              : t > span - EDGE_FADE
                ? (t - (span - EDGE_FADE)) / EDGE_FADE // fade in approaching far-L
                : 0; // off-screen, hidden
        }
        // Write transform/opacity straight to style rather than gsap.set() per
        // rotor per frame — gsap.set spins up a throwaway zero-duration tween on
        // every call (~8/frame here → GC churn). translate3d keeps each rotor on
        // its own compositor layer (the will-change hint is armed in begin(),
        // where the DOM path first animates). interpolate(1, steady, fade) is
        // inlined to avoid its per-frame allocation.
        el.style.transform = `translate3d(${crClosed(xs, s)}px, ${crClosed(ys, s)}px, 0) scale(${crClosed(sizes, s) / SHOT_BASE})`;
        el.style.opacity = `${1 + (steady - 1) * state.fade}`;
      }
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
    const begin = () => {
      if (cancelled) return;
      // Promote the tiles for the animation only. CSS no longer carries a
      // permanent will-change on them, so in the common WebGL path (where this
      // DOM collage stays hidden and never blooms) the 16 tile layers aren't
      // kept alive for nothing. Set the hint right before they first animate —
      // the bloom here, then the conveyor rides the same promoted layers.
      shots.forEach((el) => (el.style.willChange = "transform, opacity"));
      rotors.forEach((el) => (el.style.willChange = "transform, opacity"));
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
    };

    // When the welcome intro plays, the persistent WebGL scene owns the tiles for
    // the whole session (scatter → fly onto the arc → conveyor), so the DOM
    // collage stays hidden (armed `opacity:0`). We only confirm the scene really
    // starts (INTRO_START_EVENT). The intro can also BAIL — it couldn't place
    // the glass, or the load wedged past INTRO_LAST_RESORT_MS — firing
    // INTRO_REVEAL without ever starting: bloom the DOM conveyor then, since no
    // WebGL tiles will ever exist this session. The timer is only a backstop for
    // "no event ever arrived" (Intro crashed before either dispatch); it sits
    // ABOVE the last-resort budget so it can never race a live welcome that is
    // legitimately still waiting for its scene into a double collage.
    if (introWillPlay()) {
      let started = false;
      let begun = false;
      const beginOnce = () => {
        if (begun || started) return;
        begun = true;
        begin();
      };
      const onStart = () => {
        started = true;
      };
      window.addEventListener(INTRO_START_EVENT, onStart, { once: true });
      window.addEventListener(INTRO_REVEAL_EVENT, beginOnce, { once: true });
      const failsafe = window.setTimeout(beginOnce, INTRO_LAST_RESORT_MS + 5000);
      return () => {
        cancelled = true;
        window.removeEventListener(INTRO_START_EVENT, onStart);
        window.removeEventListener(INTRO_REVEAL_EVENT, beginOnce);
        window.clearTimeout(failsafe);
        tweens.forEach((t) => t.kill());
      };
    }

    // Otherwise (returning/mid-page/reduced-motion/no-WebGL) bloom the DOM tiles
    // in and run the DOM conveyor as before.
    begin();

    return () => {
      cancelled = true;
      tweens.forEach((t) => t.kill());
    };
  }, []);

  return null;
}

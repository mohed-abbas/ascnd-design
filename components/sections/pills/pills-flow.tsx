"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// The masked field height (the 1258×876 "Pills" box in pills.tsx).
const BOX_H = 876;
// Fully-clear margin above/below the box: a pill this far past an edge is
// entirely outside the clipped box, so its upward wrap is unseen. ≥ pill height.
const CLEAR = 60;
// Vertical distance a pill travels before wrapping (top-clear → bottom-clear).
const RANGE = BOX_H + CLEAR * 2;
// Upward drift speed — deliberately "really slow". px per second.
const PX_PER_SEC = 14;

// Random opacity "twinkle": each pill fades in, holds, fades out, holds — on its
// own timing + phase, so pills materialise and vanish anywhere in the field
// (not only by rising in from the bottom).
const FADE_IN = 1.4; // gentle appear
// Fade out "really slowly", at a pace comparable to the upward drift: the pill
// dissolves over the time it would drift FADE_OUT_DIST px, and LINEARLY (like the
// drift's ease) so the opacity falls at a constant rate — a slow dissolve, not a
// blink.
const FADE_OUT_DIST = 105; // px of drift-equivalent
const FADE_OUT = FADE_OUT_DIST / PX_PER_SEC; // ≈ 7.5s at 14 px/s
const VIS_HOLD = [2, 5]; // seconds fully visible (min, +range)
const INV_HOLD = [1.5, 3.5]; // seconds invisible (min, +range)

// Deterministic 0..1 from a seed (fract of a big sine). Stable across renders,
// no Math.random, so no hydration/first-paint surprise.
const rand = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

/**
 * Pill flow (Figma frame SectionPills). Two independent, per-pill motions:
 *
 *  1. DRIFT — the field creeps slowly upward forever. Each pill rises and, once
 *     it fully clears the box (into the clipped margin), wraps back below to rise
 *     again, so the field never empties. The wrap is off-screen, so it's seamless.
 *
 *  2. TWINKLE — each pill independently fades in, holds, fades out, holds, on its
 *     own random period + phase. Because opacity is decoupled from position, a
 *     pill can appear or disappear ANYWHERE in the field, not just enter from the
 *     bottom edge. A faded-out pill is visibility:hidden, so its backdrop-blur
 *     stops computing (fewer live blurs at once).
 *
 * The fixed radial mask (pills.tsx) still caps each pill by position — the twinkle
 * opacity multiplies with it — so edge pills stay faint even at full twinkle.
 *
 * Renders nothing — drives the [data-pill] nodes from pills.tsx.
 *
 * House-rules compliance:
 * - Rides GSAP's shared ticker (LenisProvider) — no private rAF.
 * - IDLES TO ZERO: drift + twinkle only run while the section overlaps the
 *   viewport (ScrollTrigger onToggle); off-screen everything is paused.
 * - Reduced-motion: no drift, no twinkle — the pills sit visible at rest.
 */
export default function PillsFlow() {
  useEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-pills]");
    if (!section) return;
    const pills = gsap.utils.toArray<HTMLElement>("[data-pill]", section);
    if (!pills.length) return;

    const reduce = window.matchMedia(REDUCE_MOTION).matches;

    const ctx = gsap.context(() => {
      if (reduce) {
        gsap.set(pills, { autoAlpha: 1 });
        return;
      }

      gsap.set(pills, { autoAlpha: 0 });

      const anims: (gsap.core.Tween | gsap.core.Timeline)[] = [];

      pills.forEach((el, i) => {
        // Base top now comes from a CSS var (--dt/--mt, switched by media query
        // in pills.tsx), not an inline style, so read the resolved value.
        const top = parseFloat(getComputedStyle(el).top) || 0;

        // 1) Upward drift. The modifier wraps `y` so the pill's absolute position
        // (style `top` + y) cycles within [-CLEAR, BOX_H + CLEAR): rising past the
        // top-clear re-appears at the bottom-clear — both outside the clipped box.
        const wrapY = gsap.utils.wrap(-CLEAR - top, BOX_H + CLEAR - top);
        anims.push(
          gsap.to(el, {
            y: `-=${RANGE}`,
            duration: RANGE / PX_PER_SEC,
            ease: "none",
            repeat: -1,
            paused: true,
            modifiers: { y: (v) => `${wrapY(parseFloat(v))}px` },
          }),
        );

        // 2) Random twinkle: fade in → hold visible → fade out → hold invisible.
        const visHold = VIS_HOLD[0] + rand(i * 3.3) * VIS_HOLD[1];
        const invHold = INV_HOLD[0] + rand(i * 4.7) * INV_HOLD[1];
        const tl = gsap.timeline({ repeat: -1, paused: true });
        tl.fromTo(
          el,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: FADE_IN, ease: "power2.out" },
        )
          .to(el, {
            autoAlpha: 0,
            duration: FADE_OUT,
            ease: "none",
            delay: visHold,
          })
          .to({}, { duration: invHold }); // hold invisible before repeating
        tl.progress(rand(i * 5.9)); // random phase — desynced from the start
        anims.push(tl);
      });

      const play = () => anims.forEach((a) => a.play());
      const pause = () => anims.forEach((a) => a.pause());

      // Idle to zero: only animate while the section overlaps the viewport.
      ScrollTrigger.create({
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => (self.isActive ? play() : pause()),
      });
    }, section);

    return () => ctx.revert(); // kills tweens + triggers, clears transforms
  }, []);

  return null;
}

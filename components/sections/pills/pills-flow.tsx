"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// The masked field height (the 1258×876 "Pills" box in pills.tsx).
const BOX_H = 876;
// Fully-clear margin above/below the box: a pill this far past an edge is
// entirely outside the clipped box (invisible), so it can wrap without a visible
// jump. ≥ one pill height.
const CLEAR = 60;
// Vertical distance a pill travels before wrapping (top-clear → bottom-clear).
const RANGE = BOX_H + CLEAR * 2;
// Upward drift speed — deliberately "really slow". px per second.
const PX_PER_SEC = 14;
// Individual fade-in on reveal.
const FADE_DUR = 0.6;
const FADE_STAGGER = 0.05;

/**
 * Pill flow (Figma frame SectionPills). The field drifts slowly UPWARD forever:
 * each pill rises, fades out through the top of the fixed radial mask (pills.tsx)
 * and — once it has fully cleared the box (into the clipped zone) — wraps back
 * below to rise again, so fresh pills keep entering the mask from the bottom.
 * The mask does all the fade-in/out; the wrap happens off-screen (the box is
 * overflow-hidden), so the loop is seamless.
 *
 * On reveal the pills first fade in INDIVIDUALLY (staggered) at their resting
 * scatter, then the drift begins.
 *
 * Renders nothing — drives the [data-pill] nodes from pills.tsx (same driver
 * split as the other sections).
 *
 * House-rules compliance:
 * - Rides GSAP's shared ticker (LenisProvider) — no private rAF.
 * - IDLES TO ZERO: the drift only plays while the section overlaps the viewport
 *   (ScrollTrigger onToggle); off-screen it's paused.
 * - Reduced-motion: no fade, no drift — the pills sit at their resting spots.
 *
 * Uniform speed + a shared travel RANGE keeps the design's scatter intact as it
 * cycles (every pill rises in lock-step and wraps over the same distance, so the
 * relative spacing never drifts apart).
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

      // Hidden until the section reveals, then fade in one by one.
      gsap.set(pills, { autoAlpha: 0 });

      // One continuous upward tween per pill. The modifier wraps `y` so that the
      // pill's absolute position (its style `top` + y) cycles within
      // [-CLEAR, BOX_H + CLEAR): when it rises past the top-clear it re-appears at
      // the bottom-clear — both fully outside the box, so the wrap is unseen.
      const drift = pills.map((el) => {
        const top = parseFloat(el.style.top) || 0;
        const wrapY = gsap.utils.wrap(-CLEAR - top, BOX_H + CLEAR - top);
        return gsap.to(el, {
          y: `-=${RANGE}`,
          duration: RANGE / PX_PER_SEC,
          ease: "none",
          repeat: -1,
          paused: true,
          modifiers: { y: (v) => `${wrapY(parseFloat(v))}px` },
        });
      });

      const play = () => drift.forEach((t) => t.play());
      const pause = () => drift.forEach((t) => t.pause());

      // Reveal: fade the pills in individually the first time the section enters,
      // and start the drift.
      ScrollTrigger.create({
        trigger: section,
        start: "top 80%",
        once: true,
        onEnter: () => {
          gsap.to(pills, {
            autoAlpha: 1,
            duration: FADE_DUR,
            ease: "power2.out",
            stagger: { each: FADE_STAGGER, from: "random" },
          });
          play();
        },
      });

      // Idle to zero: drift only while the section overlaps the viewport.
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

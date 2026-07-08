"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { setWheelProgress } from "./showcase-scroll-state";
import { PIN_VH_PER_STEP, WHEEL_SWEEP_STEPS } from "./showcase-spec";

gsap.registerPlugin(ScrollTrigger);

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Fade the per-card DOM captions out the instant the wheel starts turning, and
// back in at rest. The captions are anchored to each card's RESTING slot, so
// they can't follow the spinning WebGL cards — this hides the mismatch. (Titles
// that ride the cards through the turn are a later phase: baked into the card
// texture, ten.375-style.) A soft cutoff so it reads as a quick fade, not a pop.
const CAPTION_FADE_END = 0.06; // fully faded by 6% of the sweep
function captionOpacity(progress: number): number {
  const t = Math.min(1, progress / CAPTION_FADE_END);
  return 1 - t * t * (3 - 2 * t); // 1 → 0, smoothstepped
}

/**
 * Scroll rotation driver (Phase 2). Renders nothing.
 *
 * Pins the showcase section and scrubs the wheel's rotation as you scroll: the
 * fan spins in place, cycling the later projects up through the centre, then the
 * section UNPINS once they've all passed and normal scroll resumes (the section
 * is the page's last, so the page simply ends after). Progress (0→1) is written
 * to the shared store; the WebGL rig turns the wheel and repaints (demand mode).
 *
 * Only mounted on the WebGL path (showcase-scene.tsx gates it on the same
 * eligibility as the canvas), so reduced-motion / no-WebGL / mobile never pin —
 * they keep the static DOM arc and scroll normally.
 *
 * Pins the SECTION, which must sit in normal block flow to get pin-spacing —
 * hence the `shrink-0` wrapper in app/page.tsx (the body is a flex column, and
 * ScrollTrigger can't grow pin-spacing on a direct flex child).
 */
export default function ShowcaseScroll() {
  useIsomorphicLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-showcase]");
    const wheel = section?.querySelector<HTMLElement>("[data-showcase-wheel]");
    if (!section) return;

    const apply = (progress: number) => {
      setWheelProgress(progress);
      if (wheel) wheel.style.opacity = String(captionOpacity(progress));
    };

    const st = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: () =>
        "+=" + window.innerHeight * WHEEL_SWEEP_STEPS * PIN_VH_PER_STEP,
      pin: true,
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => apply(self.progress),
      onRefresh: (self) => apply(self.progress),
    });

    return () => {
      st.kill();
      setWheelProgress(0);
      if (wheel) wheel.style.opacity = "";
    };
  }, []);

  return null;
}

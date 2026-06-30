"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// useLayoutEffect on the client (wires the trigger before paint, no flash);
// falls back to useEffect during SSR. Mirrors the other *-reveal drivers.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// Focus-pull timing.
const DURATION = 1.5;
const EASE = "power2.out";

/**
 * Tagline focus-pull. Renders nothing. The headline rests soft-focused via CSS
 * (`blur-[0.43vw]` in tagline.tsx — that blurred state is the default, so it's
 * what SSR and no-JS show). On scroll, once the section's top crosses the 70%
 * line of the viewport, we tween the blur out to a crisp 0 — a camera pulling
 * focus as the statement comes into view. Scrolling back up reverses it, so the
 * line softens again when it leaves the frame.
 *
 * The pull is driven by explicit ScrollTrigger callbacks (onEnter/onLeaveBack)
 * rather than `toggleActions`. This is deliberate: toggleActions are (re)applied
 * on every load/refresh from the trigger's resolved state, so a load that lands
 * with the tagline ALREADY past the start line — a refresh parked on this
 * section, or returning mid-page — would auto-run the pull, and the headline
 * visibly un-blurred "on load". Callbacks instead fire only when the scroll
 * actually CROSSES the start/end, never retroactively on mount. We then set the
 * correct resting state once (crisp if already in view, else the CSS blur), so
 * the focus-pull is purely a scroll-into-view effect, not a load effect.
 *
 * The tween starts paused, so GSAP captures the *current* computed filter (the
 * `0.43vw` resolved to px) as its start lazily on first play — the resting blur
 * stays viewport-responsive at load and the tween only ever animates px→px.
 * Reduced-motion users get the crisp headline immediately (no soft resting state
 * they could never scroll out of).
 */
export default function TaglineReveal() {
  useIsomorphicLayoutEffect(() => {
    const line = document.querySelector<HTMLElement>("[data-tagline-line]");
    const section = line?.closest<HTMLElement>("[data-tagline]");
    if (!line || !section) return;

    if (window.matchMedia(REDUCE_MOTION).matches) {
      gsap.set(line, { filter: "blur(0px)" });
      return;
    }

    const tween = gsap.to(line, {
      filter: "blur(0px)",
      duration: DURATION,
      ease: EASE,
      paused: true,
    });

    const st = ScrollTrigger.create({
      trigger: section,
      start: "top 70%", // section top reaches 70% down the viewport
      onEnter: () => tween.play(),
      onLeaveBack: () => tween.reverse(),
    });

    // Resting state for the scroll position we loaded at: if the section is
    // already in view (past the start line), snap straight to crisp with no
    // animation; otherwise leave it at the CSS resting blur until scrolled in.
    if (st.isActive) tween.progress(1);

    return () => {
      st.kill();
      tween.kill();
    };
  }, []);

  return null;
}

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
const EASE = "power2.out"; // blur clears fast, then settles
// The headline rests under-scaled and grows to 1 as it sharpens, so the
// statement reads as settling forward into focus (drives --tagline-scale,
// applied as the native `scale` in globals.css). The scale uses a back-loaded
// ease (vs the blur's front-loaded power2.out) ON PURPOSE: power2.out would do
// most of the growth in the first ~0.4s while the text is still blurred, hiding
// it. power1.in keeps the headline growing as it comes into focus, so the
// scale-up is actually perceptible.
const START_SCALE = 0.85;
const SCALE_EASE = "power1.in";

/**
 * Tagline focus-pull. Renders nothing. The headline rests soft-focused via CSS
 * (`blur-[0.43vw]` in tagline.tsx — that blurred state is the default, so it's
 * what SSR and no-JS show) and slightly under-scaled. On scroll, once the
 * section's top crosses the 70% line of the viewport, we tween the blur out to a
 * crisp 0 AND scale the headline up to 1 in lock-step — a camera pulling focus
 * as the statement settles forward into view. Scrolling back up reverses it, so
 * the line softens and eases back when it leaves the frame.
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
      gsap.set(line, { filter: "blur(0px)", "--tagline-scale": 1 });
      return;
    }

    // Resting state for the scale half of the pull (the blur half rests in CSS).
    gsap.set(line, { "--tagline-scale": START_SCALE });

    // A paused timeline runs both channels together but with their OWN eases:
    // the blur clears front-loaded (power2.out) while the scale grows back-loaded
    // (power1.in), so the headline is still visibly swelling as it sharpens. The
    // blur tween still captures its start lazily on first play, keeping the
    // `0.43vw` resting blur viewport-responsive.
    const tween = gsap
      .timeline({ paused: true })
      .to(line, { filter: "blur(0px)", duration: DURATION, ease: EASE }, 0)
      .to(
        line,
        { "--tagline-scale": 1, duration: DURATION, ease: SCALE_EASE },
        0,
      );

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

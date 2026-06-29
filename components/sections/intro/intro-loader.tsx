"use client";

import { useEffect, useState } from "react";
import {
  INTRO_REVEAL_EVENT,
  INTRO_START_EVENT,
  introWillPlay,
} from "./intro-state";

/**
 * Welcome loading screen — a PURE DOM/CSS cover shown over the sky while the
 * heavy WebGL intro warms up (the Three.js/drei chunk downloads + parses, the
 * rock/shot textures load, the transmission shader compiles). It deliberately
 * uses NO WebGL: the real volumetric clouds run on the same Three stack we're
 * waiting on, so a WebGL loader would take just as long to appear and couldn't
 * cover the gap. Instead a few baked cloud-puff sprites drift over the existing
 * DOM sky with the wordmark breathing in the middle, so the wait reads as a calm
 * cloudscape rather than a blank blue hold.
 *
 * It is rendered on the server too (markup ships in the initial HTML) and is
 * visible by default, so it paints with the first CSS — before hydration, before
 * any JS chunk. The dismiss decision runs after hydration:
 *   • intro WILL play  → hold until the scene actually paints its first frame
 *     (INTRO_START_EVENT, fired by <Intro> when the master timeline starts), then
 *     crossfade out as the real clouds settle in and the glass rises. Both are
 *     empty sky at that instant, so the handoff is seamless. A failsafe drops it
 *     anyway if the scene ever stalls.
 *   • intro WON'T play (returning/mid-page/no-WebGL) → drop it next frame; the
 *     DOM hero reveals on its own with nothing heavy to wait on.
 *
 * Reduced motion hides it entirely via CSS (`display:none`), so those visitors
 * never see the drift — and introWillPlay() is false for them regardless.
 */
export default function IntroLoader() {
  // `dismissing` fades the cover out; `done` unmounts it once the fade settles
  // (so the drifting sprites stop painting). Both start false → visible on load.
  const [dismissing, setDismissing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const dismiss = () => setDismissing(true);

    // No heavy welcome to cover — let the DOM hero reveal and drop the cover on
    // the next frame (a flash of matching sky, never a lingering hold).
    if (!introWillPlay()) {
      const raf = requestAnimationFrame(dismiss);
      return () => cancelAnimationFrame(raf);
    }

    // Hold until the scene paints (INTRO_START), then crossfade out alongside the
    // real clouds. Also listen for INTRO_REVEAL: the normal path fires START
    // first, but <Intro>'s bail path (no hero/slot to place the glass) only ever
    // fires REVEAL — so whichever lands first drops the cover.
    window.addEventListener(INTRO_START_EVENT, dismiss, { once: true });
    window.addEventListener(INTRO_REVEAL_EVENT, dismiss, { once: true });
    // Failsafe: never trap the visitor behind the loader if the scene stalls.
    const t = window.setTimeout(dismiss, 6000);
    return () => {
      window.removeEventListener(INTRO_START_EVENT, dismiss);
      window.removeEventListener(INTRO_REVEAL_EVENT, dismiss);
      window.clearTimeout(t);
    };
  }, []);

  if (done) return null;

  // Three baked puffs at hand-placed spots, each drifting at its own pace via CSS
  // vars (globals.css turns these into the keyframe ranges). Sizes/opacities are
  // soft so the cloudscape reads as a backdrop, not foreground objects.
  const clouds = [
    { top: "18%", left: "-12%", size: 460, op: 0.85, dur: "26s", to: "26vw", delay: "0s" },
    { top: "54%", left: "58%", size: 540, op: 0.7, dur: "34s", to: "-22vw", delay: "-6s" },
    { top: "72%", left: "8%", size: 360, op: 0.6, dur: "30s", to: "30vw", delay: "-14s" },
  ];

  return (
    <div
      data-intro-loader
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[80] overflow-hidden transition-opacity duration-[600ms] ease-out ${
        dismissing ? "opacity-0" : "opacity-100"
      }`}
      onTransitionEnd={() => {
        if (dismissing) setDone(true);
      }}
    >
      {clouds.map((c, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src="/textures/cloud-puff.png"
          alt=""
          className="loader-cloud"
          style={
            {
              top: c.top,
              left: c.left,
              width: c.size,
              "--op": c.op,
              "--dur": c.dur,
              "--to": c.to,
              "--delay": c.delay,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Wordmark sits a touch above centre, near where the glass reveals, so the
          loader → glass handoff lands in the same spot. */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex -translate-y-[6%] flex-col items-center gap-6">
          <span className="font-product loader-wordmark text-[clamp(56px,9vw,128px)] font-medium leading-none tracking-[-0.04em] text-white">
            ascnd
          </span>
          <div className="loader-progress">
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}

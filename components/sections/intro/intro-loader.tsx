"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Logo from "@/components/ui/logo";
// Wordmark temporarily disabled in the loader column (see commented block below).
// import Wordmark from "@/components/ui/wordmark";
import {
  INTRO_GO_EVENT,
  INTRO_REVEAL_EVENT,
  introWillPlay,
} from "./intro-state";

/**
 * Welcome loading screen — a PURE DOM/CSS cover shown over the sky while the
 * heavy WebGL intro warms up (the Three.js/drei chunk downloads + parses, the
 * rock/shot textures load, the transmission shader compiles). It deliberately
 * uses NO WebGL: the real volumetric clouds run on the same Three stack we're
 * waiting on, so a WebGL loader would take just as long to appear.
 *
 * Layout follows the Figma "Hero base" loader (node 263:198): a vertically-
 * centred column — the ascend chevron mark, the "ascnd" wordmark, then a
 * hairline progress bar — over the existing DOM sky. It carries NO background of
 * its own: the global <Background/> (#62abff + grain) shows through, so there's
 * no double-grain and the handoff to the live scene is on the exact same sky.
 *
 * THE LOADER LEADS (see intro-state.ts INTRO_GO_EVENT). It plays a fixed ~3s
 * choreography, then releases <Intro>:
 *   t≈0.2s  logo masked-reveal (rises from behind its own clip line)
 *   0.3→2.4s hairline fills 0%→100% (determinate)
 *   2.4s    begin the 0.6s opacity fade-out of the whole cover
 *   3.0s    (fade done) dispatch INTRO_GO → the intro timeline starts on clean
 *           sky; the scene has been warming under the cover and is ready by ~2.5s
 * The entrance/fill are CSS so they paint before hydration (no JS chunk to wait
 * on); JS only schedules the finale + fires the handoff.
 *
 * It is rendered on the server too (markup ships in the initial HTML) and is
 * visible by default. The play decision runs after hydration:
 *   • intro WILL play  → run the welcome above, then hand off via INTRO_GO.
 *   • intro WON'T play (returning/mid-page/no-WebGL) → drop it next frame; the
 *     DOM hero reveals on its own with nothing heavy to wait on.
 *
 * Reduced motion hides it entirely via CSS (`display:none`), so those visitors
 * never see it — and introWillPlay() is false for them regardless.
 */

// The fill lands at 0.3s delay + 2.1s = 2.4s; begin the fade there. The 0.6s
// opacity transition (below) then completes the ~3s budget.
const FADE_AT_MS = 2400;

export default function IntroLoader() {
  // `dismissing` fades the cover out; `done` unmounts it once the fade settles.
  // Both start false → visible on load.
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

    // Intro will play: run the welcome, then begin the fade once the fill lands.
    const t = window.setTimeout(dismiss, FADE_AT_MS);
    // Bail safety: if <Intro> can't place the glass it fires REVEAL immediately —
    // drop the cover now rather than holding the full budget over a dead welcome.
    window.addEventListener(INTRO_REVEAL_EVENT, dismiss, { once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(INTRO_REVEAL_EVENT, dismiss);
    };
  }, []);

  if (done) return null;

  return (
    <div
      data-intro-loader
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[80] grid place-items-center overflow-hidden transition-opacity duration-[600ms] ease-out ${
        dismissing ? "opacity-0" : "opacity-100"
      }`}
      onTransitionEnd={() => {
        if (!dismissing) return;
        // Faded out — hand off. <Intro> starts its timeline on the now-clean sky;
        // the scene warmed up under the cover, so there's no stall.
        window.dispatchEvent(new Event(INTRO_GO_EVENT));
        setDone(true);
      }}
    >
      {/* The Figma "LogoContent" column (node 263:220) — chevron mark, wordmark,
          hairline progress, stacked with a 50px gap and centre-aligned. */}
      <div className="flex flex-col items-center gap-[50px]">
        {/* Logo — masked reveal: rises from behind its own clip line. */}
        <div className="loader-reveal">
          <div
            className="loader-rise"
            style={{ "--rise-delay": "0.2s" } as CSSProperties}
          >
            <Logo className="block w-[204px] text-white" />
          </div>
        </div>
        {/* Wordmark — masked reveal, staggered a beat behind the logo. */}
        {/* <div className="loader-reveal">
          <div
            className="loader-rise"
            style={{ "--rise-delay": "0.45s" } as CSSProperties}
          >
            <Wordmark className="block text-[38.5px]" />
          </div>
        </div> */}
        {/* Determinate hairline progress (node 263:227): fills 0%→100% across the
            welcome, then the whole cover fades. */}
        <div className="loader-track">
          <span className="loader-fill" />
        </div>
      </div>
    </div>
  );
}

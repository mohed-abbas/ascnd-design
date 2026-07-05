"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Logo from "@/components/ui/logo";
// Wordmark temporarily disabled in the loader column (see commented block below).
// import Wordmark from "@/components/ui/wordmark";
import {
  INTRO_GO_EVENT,
  INTRO_REVEAL_EVENT,
  INTRO_SCENE_READY_EVENT,
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
 * THE LOADER LEADS (see intro-state.ts INTRO_GO_EVENT). It plays its entrance
 * choreography, then holds the cover until the scene can ACTUALLY be seen:
 *   t≈0.2s  logo masked-reveal (rises from behind its own clip line)
 *   0.3→2.4s hairline fills 0%→85% (determinate entrance; the last 15% belongs
 *           to reality, not the clock)
 *   then    dismiss when BOTH the ~2.4s minimum show has elapsed AND the scene
 *           has genuinely painted (INTRO_SCENE_READY from SceneReady) — the bar
 *           snaps its last 15% and the 0.6s fade begins. On fast connections
 *           the scene is ready inside the minimum, so this matches the old
 *           fixed ~3s feel exactly. On slow ones the cover HOLDS at 85% —
 *           honest "almost there" — instead of fading out over a bare sky.
 *   (fade done) dispatch INTRO_GO → the intro timeline starts on clean sky.
 * If the scene never becomes ready, intro.tsx's SKIP_BUDGET fires INTRO_REVEAL
 * (the skip) and the cover drops immediately; a local HOLD_LIMIT hard-cap
 * guarantees the cover can never outlive a crashed intro either.
 * The entrance/fill are CSS so they paint before hydration (no JS chunk to wait
 * on); JS only wires the ready/skip handoff.
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

// The CSS fill parks at 85% at 0.3s delay + 2.1s = 2.4s — the minimum show.
// The cover only dismisses once this has elapsed AND the scene is ready.
const MIN_SHOW_MS = 2400;
// Let the bar's last 15% visibly land (the .loader-fill-done snap) before the
// fade starts, so "complete" reads as a beat rather than a blink.
const BAR_LAND_MS = 250;
// Hard cap: the cover must never outlive a crashed intro. intro.tsx's
// SKIP_BUDGET (6s) fires INTRO_REVEAL well before this in every live path, so
// this only exists for "no signal ever arrived".
const HOLD_LIMIT_MS = 8000;

export default function IntroLoader() {
  // `dismissing` fades the cover out; `done` unmounts it once the fade settles.
  // Both start false → visible on load. `fillDone` snaps the bar's last 15%.
  const [dismissing, setDismissing] = useState(false);
  const [done, setDone] = useState(false);
  const [fillDone, setFillDone] = useState(false);

  useEffect(() => {
    const dismiss = () => setDismissing(true);

    // No heavy welcome to cover — let the DOM hero reveal and drop the cover on
    // the next frame (a flash of matching sky, never a lingering hold).
    if (!introWillPlay()) {
      const raf = requestAnimationFrame(dismiss);
      return () => cancelAnimationFrame(raf);
    }

    // Intro will play: hold the cover until the minimum show has elapsed AND
    // the scene has genuinely painted, then complete the bar and fade.
    let minElapsed = false;
    let sceneReady = false;
    let dismissed = false;
    let landTimer: number | undefined;
    const maybeDismiss = () => {
      if (dismissed || !minElapsed || !sceneReady) return;
      dismissed = true;
      // bar just snapped to 100% (onReady) — let it land, then fade
      landTimer = window.setTimeout(dismiss, BAR_LAND_MS);
    };
    const onReady = () => {
      sceneReady = true;
      setFillDone(true);
      maybeDismiss();
    };
    const minTimer = window.setTimeout(() => {
      minElapsed = true;
      maybeDismiss();
    }, MIN_SHOW_MS);
    // Skip/bail: <Intro> fired REVEAL without a scene (SKIP_BUDGET on a slow
    // network, or it couldn't place the glass) — the DOM hero is cascading in,
    // drop the cover now.
    const onReveal = () => {
      if (dismissed) return;
      dismissed = true;
      dismiss();
    };
    const capTimer = window.setTimeout(onReveal, HOLD_LIMIT_MS);
    window.addEventListener(INTRO_SCENE_READY_EVENT, onReady, { once: true });
    window.addEventListener(INTRO_REVEAL_EVENT, onReveal, { once: true });
    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(capTimer);
      if (landTimer !== undefined) window.clearTimeout(landTimer);
      window.removeEventListener(INTRO_SCENE_READY_EVENT, onReady);
      window.removeEventListener(INTRO_REVEAL_EVENT, onReveal);
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
        {/* Determinate hairline progress (node 263:227): the CSS entrance fills
            0%→85%; the last 15% snaps in (`loader-fill-done`) when the scene is
            genuinely ready, then the whole cover fades. */}
        <div className="loader-track">
          <span
            className={`loader-fill${fillDone ? " loader-fill-done" : ""}`}
          />
        </div>
      </div>
    </div>
  );
}

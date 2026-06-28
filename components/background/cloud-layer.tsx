"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  INTRO_REVEAL_EVENT,
  INTRO_START_EVENT,
  introWillPlay,
} from "@/components/sections/intro/intro-state";
import { SKY_CLOUDS, ROCK_CLOUDS } from "./cloud-specs";

// The WebGL canvas is client-only; ssr:false must live in a Client Component
// (Next disallows it in Server Components).
const CloudCanvas = dynamic(() => import("./cloud-canvas"), { ssr: false });

// WebGL support is static per device — detect once and cache.
let webglSupport: boolean | null = null;
function hasWebGL() {
  if (webglSupport !== null) return webglSupport;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    webglSupport = !!gl;
    // Free the probe context immediately so it doesn't count against the
    // browser's WebGL context budget.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const SMALL_SCREEN = "(max-width: 768px)";

function subscribe(callback: () => void) {
  const mqs = [window.matchMedia(REDUCE_MOTION), window.matchMedia(SMALL_SCREEN)];
  mqs.forEach((mq) => mq.addEventListener("change", callback));
  return () => mqs.forEach((mq) => mq.removeEventListener("change", callback));
}

function getSnapshot() {
  return (
    hasWebGL() &&
    !window.matchMedia(REDUCE_MOTION).matches &&
    !window.matchMedia(SMALL_SCREEN).matches
  );
}

/**
 * Resolve whether the volumetric cloud canvas should mount. Skipped on
 * reduced-motion, small screens, and devices without WebGL (mandate in
 * docs/cloud-rendering-research.md §9). Server snapshot is always `false`,
 * so SSR renders the cheap fallback and re-evaluates after hydration —
 * no mismatch — and reacts to motion/breakpoint changes live.
 */
function useCanvasEligible() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * When the welcome intro plays, the clouds settle in WITH the rock entrance:
 * they start hidden, then fade + drift in on INTRO_START_EVENT (fired as the
 * intro timeline begins and the WebGL rocks drift in), so they're present for
 * the whole welcome rather than popping in at the dock. INTRO_REVEAL_EVENT (the
 * dock) is also honoured as a fallback for the intro's early-bail path. When the
 * intro is skipped (returning mid-page, reduced-motion, no WebGL), they're shown
 * immediately. The fade/settle is CSS on the wrapper (the canvas is transparent),
 * so it's independent of the demand render loop. A safety timeout reveals them
 * even if neither event arrives, so the clouds can't get stuck hidden.
 */
function useIntroReveal() {
  // Lazily seed from the shared gate: if the intro won't play, the clouds are
  // shown straight away (no effect-time setState). Otherwise start hidden and
  // wait for the intro to begin below.
  const [revealed, setRevealed] = useState(() => !introWillPlay());

  useEffect(() => {
    if (revealed) return;
    const onReveal = () => setRevealed(true);
    window.addEventListener(INTRO_START_EVENT, onReveal, { once: true });
    window.addEventListener(INTRO_REVEAL_EVENT, onReveal, { once: true });
    const failsafe = setTimeout(() => setRevealed(true), 7000);
    return () => {
      window.removeEventListener(INTRO_START_EVENT, onReveal);
      window.removeEventListener(INTRO_REVEAL_EVENT, onReveal);
      clearTimeout(failsafe);
    };
  }, [revealed]);

  return revealed;
}

/**
 * The volumetric clouds, mounted at the root (layout.tsx) as TWO independent
 * fixed layers so they can straddle the page content:
 *  - SKY layer at -z-10 → behind content but above the -z-20 sky backdrop;
 *    holds the distant sky clouds.
 *  - FRONT layer at z-[1] → above the rocks (z-0) but below the wordmark
 *    (z-10); holds the rock-base clouds so they OVERLAP the cliffs.
 * Both are pointer-events-none (never intercept clicks) and transparent except
 * where a cloud is drawn, so the front layer only covers the cliff bases.
 * Required: no `filter`/`backdrop-filter` ancestor, or the fixed canvases break.
 *
 * Two <Canvas> = two WebGL contexts; acceptable since the whole thing is gated
 * to eligible desktops, and each is a single batched <Clouds> draw.
 */
export default function CloudLayer() {
  const eligible = useCanvasEligible();
  const revealed = useIntroReveal();

  // TODO(phase 7): bake a static cloud image from the Figma design and render
  // it here as the fallback for ineligible devices. Transparent for now.
  if (!eligible) return null;

  // Soft fade + downward settle, in lock-step with the cliffs' intro entrance.
  // transform here is fine — the canvas inside is `absolute`, not a fixed
  // descendant, so it doesn't trip the fixed-positioning constraint.
  const reveal: React.CSSProperties = {
    opacity: revealed ? 1 : 0,
    transform: revealed ? "none" : "translateY(-14px)",
    // ~matches the rocks' 1.1s drift (rock-reveal.tsx) so they settle together.
    transition: "opacity 1100ms ease-out, transform 1100ms ease-out",
  };

  return (
    <>
      {/* Distant sky clouds — behind the page content. */}
      <div
        aria-hidden
        style={reveal}
        className="pointer-events-none fixed inset-0 -z-10"
      >
        <CloudCanvas clouds={SKY_CLOUDS} />
      </div>
      {/* Foreground clouds — in front of the rocks so they hug the cliff base. */}
      <div
        aria-hidden
        style={reveal}
        className="pointer-events-none fixed inset-0 z-[1]"
      >
        <CloudCanvas clouds={ROCK_CLOUDS} />
      </div>
    </>
  );
}

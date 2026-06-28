"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
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

  // TODO(phase 7): bake a static cloud image from the Figma design and render
  // it here as the fallback for ineligible devices. Transparent for now.
  if (!eligible) return null;

  return (
    <>
      {/* Distant sky clouds — behind the page content. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <CloudCanvas clouds={SKY_CLOUDS} />
      </div>
      {/* Foreground clouds — in front of the rocks so they hug the cliff base. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[1]">
        <CloudCanvas clouds={ROCK_CLOUDS} />
      </div>
    </>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

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
 * The volumetric clouds as their OWN fixed layer — a sibling of <Background/>,
 * not nested inside it, so the sky and the clouds z-stack independently. Sits
 * at -z-10 (above the -z-20 sky, below page content); pointer-events-none so it
 * never intercepts clicks. Mounted at the root (layout.tsx) — required: a
 * `filter`/`backdrop-filter` ancestor would break the fixed canvas.
 */
export default function CloudLayer() {
  const eligible = useCanvasEligible();

  // TODO(phase 7): bake a static cloud image from the Figma design and render
  // it here as the fallback for ineligible devices. Transparent for now.
  if (!eligible) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <CloudCanvas />
    </div>
  );
}

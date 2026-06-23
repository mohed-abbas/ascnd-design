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

export default function CloudLayer() {
  const eligible = useCanvasEligible();

  // TODO(phase 7): bake a static cloud image from the Figma design and render
  // it here as the fallback for ineligible devices. Transparent for now.
  if (!eligible) return null;

  return <CloudCanvas />;
}

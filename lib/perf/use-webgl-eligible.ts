"use client";

import { useSyncExternalStore } from "react";

/**
 * Shared "should a heavy WebGL canvas mount here?" gate.
 *
 * This is the eligibility rule that lives inline in
 * components/background/cloud-layer.tsx (the original copy), lifted so the
 * project-showcase wheel reuses it verbatim: WebGL present · not
 * prefers-reduced-motion · wider than the mobile breakpoint. The server
 * snapshot is always `false`, so SSR renders the cheap DOM fallback and the
 * client re-evaluates after hydration (no mismatch); it also reacts live to
 * motion-preference / breakpoint changes via matchMedia.
 *
 * cloud-layer.tsx keeps its own inline copy for now (touching the working
 * clouds is out of scope); both can converge on this hook later.
 */

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

/** True only on a capable, motion-OK, non-mobile client (false during SSR). */
export function useWebglEligible() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

// Never fires, never resubscribes — a pure "have we hydrated yet?" flip.
const noopSubscribe = () => () => {};
/** False during SSR + the hydration render, true immediately after (client). */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

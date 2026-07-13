"use client";

import { useSyncExternalStore } from "react";

/**
 * Footer glass polish switches — flip any to `false` to remove that flourish with
 * no other changes. Read by footer-glass-scene.tsx (tilt / reveal / theme) and
 * footer-reveal.tsx (which hands the entrance to the in-scene reveal when it's on).
 */
export const FOOTER_GLASS = {
  /** Mouse-driven tilt of the glass — the refraction shifts as the cursor moves. */
  pointerTilt: false,
  /** In-scene entrance: the glass wordmark slides up from BEHIND the mountain
   *  ridgeline, scrubbed to the footer's scroll-in (no fades — the mountain plane
   *  occludes it). When off, the glass parks at rest and the whole scene just
   *  blur-rises together via footer-reveal.tsx. */
  glassReveal: false,
  /** Smoothly retint the glass backdrop when the sky mode changes (vs snapping). */
  themeTween: true,
  /** One static drei <Cloud> INSIDE the glass scene (behind the wordmark), so it's
   *  refracted through the letters — a look a fixed-layer DOM cloud can't achieve.
   *  Static (no morph) so the scene still idles to zero. See <FooterCloud> in
   *  footer-glass-scene.tsx. Flip off to drop it with no other changes. */
  cloud: true,
} as const;

// ── Eligibility (shared) ─────────────────────────────────────────────────────
// WebGL support is static per device — detect once and cache.
let webglSupport: boolean | null = null;
function hasWebGL() {
  if (webglSupport !== null) return webglSupport;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    webglSupport = !!gl;
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
 * Whether the live glass canvas should run: desktop, WebGL, motion allowed. Server
 * snapshot `false`, so SSR / ineligible render the baked-glass fallback with no
 * hydration mismatch. Shared by footer-scene (what to render) and footer-reveal
 * (whether to defer the entrance to the in-scene reveal).
 */
export function useFooterGlassEligible() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

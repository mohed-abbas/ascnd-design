"use client";

import { useSyncExternalStore } from "react";
// The shared, module-cached WebGL probe (one context app-wide, released on
// probe) — see lib/webgl-support.ts. Only called from the client snapshot in
// useFooterGlassEligible; the server snapshot stays an explicit `false`.
import { hasWebGL } from "@/lib/webgl-support";

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
} as const;

// ── Eligibility (shared) ─────────────────────────────────────────────────────
// WebGL support comes from the shared, module-cached probe in
// lib/webgl-support.ts (imported at top) — one context app-wide, released on
// probe; detection is static per device.

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

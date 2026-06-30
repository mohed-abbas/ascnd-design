"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

// The WebGL canvas is client-only; ssr:false must live in a Client Component
// (Next disallows it in Server Components). Mirrors cloud-layer.tsx.
const CursorTrailCanvas = dynamic(() => import("./cursor-trail-canvas"), {
  ssr: false,
});

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
// A fluid cursor trail is meaningless without a real cursor — gate out touch /
// coarse-pointer devices (the analog of the cloud layer's screen-size check).
const FINE_POINTER = "(pointer: fine)";

function subscribe(callback: () => void) {
  const mqs = [
    window.matchMedia(REDUCE_MOTION),
    window.matchMedia(SMALL_SCREEN),
    window.matchMedia(FINE_POINTER),
  ];
  mqs.forEach((mq) => mq.addEventListener("change", callback));
  return () => mqs.forEach((mq) => mq.removeEventListener("change", callback));
}

function getSnapshot() {
  return (
    hasWebGL() &&
    !window.matchMedia(REDUCE_MOTION).matches &&
    !window.matchMedia(SMALL_SCREEN).matches &&
    window.matchMedia(FINE_POINTER).matches
  );
}

/**
 * Resolve whether the cursor-trail canvas should mount. Skipped on
 * reduced-motion, small screens, coarse/no pointer (touch), and devices
 * without WebGL. Server snapshot is always `false`, so SSR renders nothing and
 * re-evaluates after hydration — no mismatch — and reacts to motion / pointer /
 * breakpoint changes live. Mirrors cloud-layer.tsx's gate.
 */
function useCanvasEligible() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * Global cursor fluid-trail, mounted at the root (layout.tsx) as a single
 * fixed overlay. Sits at z-[90]: above the sky, clouds, hero text/shots/logos,
 * and the far right cliff (z-0), but BELOW the near left cliff (z-[99]), the
 * grass-hover overlay (z-[100]) and the navbar (z-[999]) — so the prominent
 * foreground chrome occludes the glow. (The far right cliff sits behind the
 * hero text, so it can't also occlude the trail without hiding text; see
 * docs/cursor-trail.md for the toggle.)
 *
 * pointer-events-none (wrapper AND canvas element) so it never intercepts
 * clicks. mix-blend-mode: screen makes the trail composite as additive light.
 * Required: no `filter`/`backdrop-filter` ancestor, or the fixed canvas breaks
 * — hence the root mount.
 */
export default function CursorTrail() {
  const eligible = useCanvasEligible();
  if (!eligible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[90]"
      style={{ mixBlendMode: "screen" }}
    >
      <CursorTrailCanvas />
    </div>
  );
}

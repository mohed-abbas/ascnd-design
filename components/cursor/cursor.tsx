"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  INTRO_REVEAL_EVENT,
  introWillPlay,
} from "@/components/sections/intro/intro-state";

// The WebGL fluid sim is client-only; ssr:false must live in a Client Component
// (Next disallows it in Server Components). Mirrors cloud-layer.tsx.
const SplashCursor = dynamic(() => import("./splash-cursor"), {
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
// A fluid cursor effect is meaningless without a real cursor — gate out touch /
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
 * Resolve whether the fluid cursor should mount. Skipped on reduced-motion,
 * small screens, coarse/no pointer (touch), and devices without WebGL. Server
 * snapshot is always `false`, so SSR renders nothing and re-evaluates after
 * hydration — no mismatch — and reacts to motion / pointer / breakpoint changes
 * live. Mirrors cloud-layer.tsx's gate.
 */
function useCursorEligible() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * Defer the cursor mount until the intro has docked (docs/performance-audit.md
 * T1). During the intro the fluid-sim shaders would compile alongside the glass
 * MTM in the most GPU-starved window, and its WebGL context would compete with
 * the glass for GPU the whole time — for an effect no one sees under a scroll-
 * locked welcome. So we wait for INTRO_REVEAL_EVENT (the dock). When the intro
 * is skipped (returning mid-page, reduced-motion, no WebGL) it mounts at once.
 * A failsafe reveals it even if the event never fires, so it can't get stuck.
 */
function usePastIntro() {
  const [past, setPast] = useState(() => !introWillPlay());

  useEffect(() => {
    if (past) return;
    const onReveal = () => setPast(true);
    window.addEventListener(INTRO_REVEAL_EVENT, onReveal, { once: true });
    const failsafe = setTimeout(() => setPast(true), 9000);
    return () => {
      window.removeEventListener(INTRO_REVEAL_EVENT, onReveal);
      clearTimeout(failsafe);
    };
  }, [past]);

  return past;
}

/**
 * Global fluid-simulation cursor (React Bits' SplashCursor), mounted at the
 * root (layout.tsx). SplashCursor renders its own `position: fixed`,
 * `pointer-events: none` full-viewport <canvas>, so it never intercepts clicks;
 * this wrapper only decides *whether* it mounts (eligible device + past the
 * intro). Required: no `filter`/`backdrop-filter` ancestor, or the fixed canvas
 * breaks — hence the root mount.
 */
export default function Cursor() {
  const eligible = useCursorEligible();
  const pastIntro = usePastIntro();
  // Eligible device AND the intro has finished (or was skipped) — see usePastIntro.
  if (!eligible || !pastIntro) return null;

  return <SplashCursor CURL={4} COLOR="#ffffff" />;
}

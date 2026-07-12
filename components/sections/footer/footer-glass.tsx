"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

// The WebGL scene is client-only; ssr:false must live in a Client Component.
const FooterGlassScene = dynamic(() => import("./footer-glass-scene"), {
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
 * Gate for the footer's live liquid-glass wordmark. Same pattern as cloud-layer:
 * the server snapshot is `false`, so SSR + the ineligible path render nothing here
 * (the static mountain <img> in footer.tsx shows instead) and there's no hydration
 * mismatch. When eligible (desktop, WebGL, motion allowed) it mounts the transparent
 * WebGL overlay — its mountain plane covers the fallback <img>, adding the glass.
 *
 * PHASE 1: eligibility gating is in, but the richer tier knobs + a polished static
 * fallback are Phase 2 (see memory footer-glass-wordmark).
 */
function useEligible() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export default function FooterGlass() {
  const eligible = useEligible();
  if (!eligible) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <FooterGlassScene />
    </div>
  );
}

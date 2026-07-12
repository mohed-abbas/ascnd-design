"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

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
 * Resolve whether the live glass canvas should mount: desktop, WebGL, motion
 * allowed. Same useSyncExternalStore pattern as cloud-layer — server snapshot is
 * `false`, so SSR (and the ineligible path) render the baked-glass fallback image
 * and there's no hydration mismatch; it re-evaluates + reacts to motion/breakpoint
 * changes after hydration.
 */
function useEligible() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * Footer scene controller — decides what fills the footer box:
 *  - INELIGIBLE (SSR / no-JS / mobile / reduced-motion / no-WebGL): the baked-glass
 *    composite image — mountains + the glass "ascnd" flattened from the design, so
 *    these devices still get the full look, statically.
 *  - ELIGIBLE (desktop + WebGL + motion): the plain mountain cutout as an instant
 *    placeholder, plus the live liquid-glass WebGL overlay — but the canvas is
 *    DEFERRED: it only mounts once the footer comes within a viewport of the screen
 *    (IntersectionObserver). So the app's heaviest shader never creates its WebGL
 *    context at page load (where it would contend with the intro + clouds); it
 *    spins up just before you reach the bottom, then stays mounted (idle-painting
 *    off-screen via the scene's own gate).
 */
export default function FooterScene() {
  const eligible = useEligible();
  const [near, setNear] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!eligible || near) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      // Mount ~one viewport early so the glass is warm by the time it's on screen.
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eligible, near]);

  // Ineligible (and SSR) — the baked-glass composite fills the box (its aspect
  // matches the box, so object-cover doesn't crop). Carries the brand name.
  if (!eligible) {
    return (
      <Image
        src="/footer/footer-glass-fallback.webp"
        alt="ascnd"
        fill
        sizes="100vw"
        loading="lazy"
        className="pointer-events-none select-none object-cover"
      />
    );
  }

  // Eligible — plain mountains as an instant placeholder, live glass deferred.
  return (
    <div ref={ref} className="absolute inset-0">
      {/* Placeholder / refraction twin: the mountain cutout, bottom-anchored. The
          canvas re-draws the mountains on top once it mounts, so this shows only
          until the glass spins up (and covers it). Decorative → empty alt. */}
      <Image
        src="/footer/footer-scene.webp"
        alt=""
        aria-hidden
        width={3168}
        height={1344}
        unoptimized
        loading="lazy"
        sizes="100vw"
        className="pointer-events-none absolute inset-x-0 bottom-0 block h-auto w-full select-none"
      />
      {near && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <FooterGlassScene />
        </div>
      )}
    </div>
  );
}

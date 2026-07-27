"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  INTRO_REVEAL_EVENT,
  INTRO_START_EVENT,
  introWillPlay,
} from "@/components/sections/intro/intro-state";
import { cloudSceneForPath } from "./cloud-specs";
import StaticCloudLayer from "./static-cloud-layer";
import { staticCloudsForPath } from "./static-cloud-specs";
import { FRONT_INDEX, REAR_INDEX } from "@/components/canvas/indices";
// The shared, module-cached WebGL probe (one context ever, released on probe) —
// see lib/webgl-support.ts. Only called from the client snapshot below; the
// server snapshot stays an explicit `false`.
import { hasWebGL } from "@/lib/webgl-support";

// The R3F cloud view is client-only (pulls three/drei); ssr:false must live in a
// Client Component. It renders NO DOM — it registers one view on a shared canvas
// plane (components/canvas/) via useSharedView; the host's fixed plane Canvas
// scissors it to the track div below.
const CloudView = dynamic(() => import("./cloud-canvas"), { ssr: false });

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
 * Resolve whether the volumetric cloud views should mount. Skipped on
 * reduced-motion, small screens, and devices without WebGL (mandate in
 * docs/cloud-rendering-research.md §9). Server snapshot is always `false`,
 * so SSR renders the cheap fallback and re-evaluates after hydration —
 * no mismatch — and reacts to motion/breakpoint changes live.
 */
function useCanvasEligible() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * The intro reveal for the STATIC fallback (the WebGL path fades in-scene via
 * <RevealRig> in cloud-canvas.tsx). When the welcome intro plays, the fallback
 * sprites settle in WITH the rock entrance: hidden, then fade/drift in on
 * INTRO_START_EVENT (INTRO_REVEAL_EVENT is the dock fallback). Skipped intros show
 * immediately. A safety timeout reveals them even if neither event arrives.
 */
function useIntroReveal() {
  const [revealed, setRevealed] = useState(() => !introWillPlay());

  useEffect(() => {
    if (revealed) return;
    const onReveal = () => setRevealed(true);
    window.addEventListener(INTRO_START_EVENT, onReveal, { once: true });
    window.addEventListener(INTRO_REVEAL_EVENT, onReveal, { once: true });
    const failsafe = setTimeout(() => setRevealed(true), 7000);
    return () => {
      window.removeEventListener(INTRO_START_EVENT, onReveal);
      window.removeEventListener(INTRO_REVEAL_EVENT, onReveal);
      clearTimeout(failsafe);
    };
  }, [revealed]);

  return revealed;
}

/**
 * The volumetric clouds, mounted at the root (layout.tsx) as TWO shared-canvas
 * views so they can straddle the page content (docs/canvas-consolidation-plan.md
 * Phase 4):
 *  - SKY_CLOUDS → the REAR plane (z -10): behind content, above the -z-20 sky
 *    backdrop; the distant sky clouds.
 *  - ROCK_CLOUDS → the FRONT plane (z 61): above the rocks/intro cliffs, so the
 *    rock-base skirt overlaps the cliffs; welded to the cliff feet.
 * Each is registered by a <CloudView> that renders no DOM; its `track` is a fixed
 * inset-0 div here (the plane provides the z-stacking, so the track needs no
 * z-index — it's just a full-viewport rect for the host <View> to scissor to).
 * Both planes are pointer-events-none siblings of the fixed sky layers (no
 * filter/backdrop-filter ancestor, or the fixed canvases break).
 *
 * The reveal fade is now IN-SCENE (cloud-canvas <RevealRig>), not a CSS opacity on
 * these tracks — the clouds render on the shared plane canvas, not inside these
 * (empty) track divs, so a CSS opacity here would not touch the rendered pixels.
 */
// For the hydration gate below — never fires, never resubscribes.
const noopSubscribe = () => () => {};

export default function CloudLayer() {
  const eligible = useCanvasEligible();
  const revealed = useIntroReveal();
  const skyTrackRef = useRef<HTMLDivElement>(null);
  const rockTrackRef = useRef<HTMLDivElement>(null);
  // Per-route cloud arrangement. This layer is mounted ONCE at the root, so a
  // client-side navigation keeps the shared WebGL context alive and only swaps
  // the registered specs (cloud-specs.ts CLOUD_SCENES). usePathname re-renders
  // this on route change; the CloudView children re-register with the new specs.
  const pathname = usePathname();
  const scene = cloudSceneForPath(pathname);
  const staticClouds = staticCloudsForPath(pathname);
  // The welcome intro (and its cloud reveal) is homepage-only; on any other route
  // the clouds must ease themselves in on load rather than pop. See RevealRig.
  const revealOnLoad = pathname !== "/";
  // False for SSR + the hydration render, true right after. The static fallback
  // must NOT be decided server-side: `eligible` is unknowable there (its server
  // snapshot is always false) and `introWillPlay()` returns false on the server,
  // so SSR would bake the fallback images into the HTML at full opacity. Render
  // nothing until the client knows the real answer.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  // Soft fade + downward settle for the STATIC fallback, in lock-step with the
  // cliffs' intro entrance.
  const reveal: React.CSSProperties = {
    opacity: revealed ? 1 : 0,
    transform: revealed ? "none" : "translateY(-14px)",
    transition: "opacity 1100ms ease-out, transform 1100ms ease-out",
  };

  if (!hydrated) return null;

  // Static-sprite fallback for ineligible devices (mobile, reduced-motion,
  // no-WebGL): individual baked cloud sprites distributed across every section
  // and scroll-driven in DOM (GSAP transforms) — see static-cloud-layer.tsx.
  if (!eligible) {
    // Nothing to render for a route whose static scene is empty (e.g. /pricing
    // today) — skip the empty strata entirely.
    if (staticClouds.length === 0) return null;
    return <StaticCloudLayer clouds={staticClouds} reveal={reveal} />;
  }

  return (
    <>
      {/* Distant sky clouds — REAR plane (z -10), behind page content. Welded 1:1
          to the page (scrollFactor 1), matching the pre-bench behaviour. Skipped
          when the route's scene declares no sky clouds. */}
      {scene.sky.length > 0 && (
        <div
          ref={skyTrackRef}
          aria-hidden
          className="pointer-events-none fixed inset-0 min-h-[100lvh]"
        >
          <CloudView
            plane="rear"
            index={REAR_INDEX.SKY_CLOUDS}
            track={skyTrackRef}
            clouds={scene.sky}
            scrollFactor={1}
            revealOnLoad={revealOnLoad}
          />
        </div>
      )}
      {/* Foreground clouds — FRONT plane (z 61), above the cliffs so the rock-base
          skirt overlaps them. A thin band pinned to the very bottom (rock clouds
          ndc y ≈ -1.02), so leapfrogging the top-anchored wordmark (z-10)/content
          is spatially harmless. scrollFactor MUST stay 1: these are welded to the
          cliff feet (page content scrolling 1:1); any damping slides them off.
          Skipped when the route's scene declares no rock clouds (e.g. /pricing,
          which has no hero cliffs). */}
      {scene.rock.length > 0 && (
        <div
          ref={rockTrackRef}
          aria-hidden
          className="pointer-events-none fixed inset-0 min-h-[100lvh]"
        >
          <CloudView
            plane="front"
            index={FRONT_INDEX.ROCK_CLOUDS}
            track={rockTrackRef}
            clouds={scene.rock}
            scrollFactor={1}
            revealOnLoad={revealOnLoad}
          />
        </div>
      )}
    </>
  );
}

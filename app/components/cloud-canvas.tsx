"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Cloud, Clouds } from "@react-three/drei";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Group } from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useCloudMode } from "./cloud-mode";

/**
 * Volumetric cloud field (Three.js / R3F + drei <Clouds>).
 *
 * Render strategy (see docs/cloud-rendering-research.md §9):
 * - frameloop="demand": no free-running rAF. Clouds have speed=0 (static), so
 *   we only paint when something actually changes — scroll parallax, the first
 *   few mount frames (drei builds geometry + loads the texture over several
 *   frames), tab re-show, and WebGL context restore. See <InvalidateOnReady>.
 * - Single batched <Clouds> draw call; self-hosted sprite texture.
 * - Transparent canvas (alpha) drawing only clouds — color/grain stay DOM.
 * - antialias off, dpr clamped, minimal lights, no shadows.
 * - frustumCulled={false} on <Clouds>: the internal InstancedMesh has
 *   matrixAutoUpdate=false and dynamic instance matrices, so its bounding
 *   sphere goes stale as parallax moves the groups — which would frustum-cull
 *   the whole batch and make clouds vanish on scroll. One batched mesh, so the
 *   cost of always drawing it is negligible.
 *
 * Context-loss resilience: we rely on THREE.WebGLRenderer's BUILT-IN
 * webglcontextlost/restored handling. We deliberately do NOT add our own
 * preventDefault()/restore — that is a documented anti-pattern that fights the
 * renderer and (when the listeners aren't cleaned up) leaks across Fast
 * Refresh. <ContextWatchdog> only adds a safety net: repaint on restore, and a
 * last-resort Canvas remount if a real driver reset never restores. Linux/Mesa
 * drivers reclaim GL contexts aggressively, so this matters.
 *
 * Placement/scale/opacity are tuned to the Figma "Clouds" node (155:145 /
 * 103:5) — see the LAYERS comment below.
 */

type Layer = {
  /** position [x, y, z] — more negative z = deeper = smaller parallax shift */
  pos: [number, number, number];
  bounds: [number, number, number];
  volume: number;
  segments: number;
  opacity: number;
  /** per-cloud billow — higher = softer, puffier spread */
  growth: number;
  /** parallax multiplier (world units of y-shift per full page scroll) */
  parallax: number;
};

// Composition matched to the Figma hero (node 103:4) "clouds" node 156:149: a
// SINGLE soft cloud cluster sitting in the TOP-RIGHT corner (node x 1031–1500,
// y 0–479 of the 1512×982 frame → ~68–99% width, top ~49% height), behind the
// image collage. The rest of the sky stays clear blue. +x is right, +y is up
// (camera looks down -z from z=10; at z=0 the frame spans roughly x ±6.4, y ±4.1).
//
// Keep this compact and top-right — earlier versions sprawled across the centre
// and bottom (a wisp + a lower-right mass) that the Figma does not have. Shape
// comes from sprite density/bounds/opacity (especially in the default "flat"
// MeshBasicMaterial mode, which is unlit); edges feather as drei's
// concentrate="inside" thins the outer sprites, letting the blue sky breathe.
const LAYERS: Layer[] = [
  // Soft main body of the cluster, centred in the top-right.
  { pos: [4.0, 2.0, 0], bounds: [2.4, 1.8, 1.2], volume: 2.6, segments: 20, opacity: 0.7, growth: 4, parallax: 3.0 },
  // Denser, brighter core toward the upper-right (the cloud's bright heart).
  { pos: [4.8, 2.7, 0.4], bounds: [1.6, 1.3, 1.0], volume: 2.0, segments: 14, opacity: 0.92, growth: 3, parallax: 2.6 },
  // Thin feather trailing down and toward centre — softens the inner edge.
  { pos: [2.6, 0.9, -0.5], bounds: [2.0, 1.3, 1.0], volume: 1.8, segments: 12, opacity: 0.4, growth: 4, parallax: 3.6 },
];

/** Drives cloud-layer parallax from global page scroll. */
function ParallaxRig({
  groupsRef,
}: {
  groupsRef: React.RefObject<(Group | null)[]>;
}) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const base = LAYERS.map((_, i) => groupsRef.current[i]?.position.y ?? 0);

    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        groupsRef.current.forEach((g, i) => {
          if (g) g.position.y = base[i] - p * LAYERS[i].parallax;
        });
        invalidate();
      },
    });

    return () => st.kill();
  }, [groupsRef, invalidate]);

  return null;
}

/**
 * Demand-mode painting helper. drei's <Clouds> builds its instanced geometry
 * and loads the texture over several frames, and its per-frame instance update
 * lives in a useFrame that only runs when a frame is requested — so a single
 * mount frame can paint blank. We pump invalidate() for a short burst after
 * mount (and a few delayed nudges to cover slower texture decode), then repaint
 * whenever the tab becomes visible again (throttled tabs drop the last frame).
 */
function InvalidateOnReady() {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    let raf = 0;
    let frames = 0;
    const pump = () => {
      invalidate();
      if (++frames < 8) raf = requestAnimationFrame(pump);
    };
    pump();

    // Insurance against texture decode landing after the rAF burst.
    const timers = [100, 300, 600].map((ms) => setTimeout(invalidate, ms));

    const onVisible = () => {
      if (document.visibilityState === "visible") invalidate();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [invalidate]);

  return null;
}

/**
 * Repaints the demand-mode canvas whenever `dep` changes (e.g. the cloud mode
 * toggles material/lights). drei rebuilds the material but won't request a frame
 * on its own under frameloop="demand", so we pump a short invalidate burst.
 */
function RepaintOn({ dep }: { dep: unknown }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    const pump = () => {
      invalidate();
      if (++frames < 6) raf = requestAnimationFrame(pump);
    };
    pump();
    return () => cancelAnimationFrame(raf);
  }, [dep, invalidate]);
  return null;
}

/**
 * WebGL context-loss safety net. THREE handles lost/restored internally; here
 * we only (a) repaint after a restore (demand mode needs an explicit frame) and
 * (b) if a restore never arrives within a few seconds (unrecoverable driver
 * reset), ask the parent to remount the <Canvas> with a fresh context. All
 * listeners/timers are cleaned up, so nothing accumulates across Strict Mode /
 * Fast Refresh.
 */
function ContextWatchdog({
  onUnrecoverable,
}: {
  onUnrecoverable: () => void;
}) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const canvas = gl.domElement;
    let mounted = true;
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;

    const onLost = () => {
      // THREE already calls preventDefault() and will restore on its own for
      // recoverable losses. Arm a fallback only for a loss that never restores.
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => {
        // Remount ONLY a genuinely unrecoverable loss on a still-live, visible
        // canvas. This skips R3F's intentional force-context-loss during
        // unmount (the canvas is detached by the time the timer fires) and
        // stale timers from a previous Strict Mode / Fast Refresh instance —
        // both of which would otherwise cause a needless remount.
        if (
          mounted &&
          canvas.isConnected &&
          document.visibilityState === "visible"
        ) {
          onUnrecoverable();
        }
      }, 4000);
    };
    const onRestored = () => {
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = undefined;
      invalidate();
    };

    canvas.addEventListener("webglcontextlost", onLost, false);
    canvas.addEventListener("webglcontextrestored", onRestored, false);

    return () => {
      mounted = false;
      if (restoreTimer) clearTimeout(restoreTimer);
      canvas.removeEventListener("webglcontextlost", onLost, false);
      canvas.removeEventListener("webglcontextrestored", onRestored, false);
    };
  }, [gl, invalidate, onUnrecoverable]);

  return null;
}

export default function CloudCanvas() {
  const groupsRef = useRef<(Group | null)[]>([]);
  // Bumping this remounts the <Canvas> with a fresh GL context — last resort
  // when a lost context never restores. See <ContextWatchdog>.
  const [canvasKey, setCanvasKey] = useState(0);
  const remount = useCallback(() => setCanvasKey((k) => k + 1), []);

  // Cloud look, toggled live via <CloudModeToggle/> (see ./cloud-mode + the
  // colour/lighting doc). "lit" = Option 1 (MeshLambertMaterial + key light,
  // dimensional); "flat" = Option 2 (MeshBasicMaterial, unlit, guaranteed white).
  const mode = useCloudMode();
  const cloudMaterial =
    mode === "flat" ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;

  return (
    <Canvas
      key={canvasKey}
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true }}
      // Force NoToneMapping at renderer creation. R3F defaults to ACES Filmic,
      // which maps linear white (1.0) down to ~0.8 and is the reason pure-white
      // clouds rendered grey. The `flat` prop is meant to do this but proved
      // unreliable here, so we set it explicitly in onCreated — it runs once
      // before the first frame and persists across hot-reloads (the renderer
      // isn't recreated on HMR). The Figma cloud core is #fcfeff (≈#ffffff), so
      // we want the white to pass through linearly.
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
      }}
      camera={{ position: [0, 0, 10], fov: 45 }}
      style={{ position: "absolute", inset: 0 }}
    >
      {/* Lights only matter in "lit" mode — MeshBasicMaterial ("flat") is unlit
          and ignores them, so we skip them entirely there.

          Key-dominant lighting (see docs/cloud-color-and-lighting.md). The cloud's
          dimensional form comes from a LIGHT GRADIENT — bright sunlit tops fading
          to softly-shadowed undersides — exactly like the Figma sky photo. A
          strong overhead key sculpts that gradient; a moderate ambient fill keeps
          the undersides light rather than muddy. (Flooding flat ambient, as we did
          before, makes a uniform formless blob that reads grey even when white.)
          Translucency/softness at the edges comes from the sprite alpha, letting
          the blue sky breathe through. NoToneMapping (onCreated) keeps these
          whites from being pulled grey by ACES. */}
      {mode === "lit" && (
        <>
          <ambientLight intensity={1.05} />
          <directionalLight position={[-3, 9, 6]} intensity={1.6} />
          <pointLight position={[3.5, 6, 5]} intensity={50} decay={2} />
        </>
      )}

      <Clouds
        material={cloudMaterial}
        texture="/textures/cloud.png"
        limit={200}
        frustumCulled={false}
      >
        {LAYERS.map((layer, i) => (
          <group
            key={i}
            position={layer.pos}
            ref={(el) => {
              groupsRef.current[i] = el;
            }}
          >
            <Cloud
              seed={i + 1}
              segments={layer.segments}
              bounds={layer.bounds}
              volume={layer.volume}
              opacity={layer.opacity}
              speed={0}
              growth={layer.growth}
              color="#ffffff"
            />
          </group>
        ))}
      </Clouds>

      <ParallaxRig groupsRef={groupsRef} />
      <InvalidateOnReady />
      <RepaintOn dep={mode} />
      <ContextWatchdog onUnrecoverable={remount} />
    </Canvas>
  );
}

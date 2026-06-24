"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Cloud, Clouds } from "@react-three/drei";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Group } from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

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
 * Placement/scale/colour are first-pass and get tuned against the Figma
 * design (node 103:5) in a later pass.
 */

type Layer = {
  /** position [x, y, z] — more negative z = deeper = smaller parallax shift */
  pos: [number, number, number];
  bounds: [number, number, number];
  volume: number;
  segments: number;
  opacity: number;
  /** parallax multiplier (world units of y-shift per full page scroll) */
  parallax: number;
};

const LAYERS: Layer[] = [
  { pos: [3, 2.4, -6], bounds: [7, 2, 2], volume: 6, segments: 26, opacity: 0.5, parallax: 2 },
  { pos: [-3.4, 1.6, -2], bounds: [6, 1.8, 1.8], volume: 5, segments: 22, opacity: 0.65, parallax: 3.4 },
  { pos: [1.4, -0.4, 1], bounds: [5, 1.6, 1.6], volume: 4, segments: 18, opacity: 0.8, parallax: 5 },
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

  return (
    <Canvas
      key={canvasKey}
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true }}
      camera={{ position: [0, 0, 10], fov: 45 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 10, 8]} intensity={1.1} />

      <Clouds
        material={THREE.MeshLambertMaterial}
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
              growth={4}
              color="#ffffff"
            />
          </group>
        ))}
      </Clouds>

      <ParallaxRig groupsRef={groupsRef} />
      <InvalidateOnReady />
      <ContextWatchdog onUnrecoverable={remount} />
    </Canvas>
  );
}

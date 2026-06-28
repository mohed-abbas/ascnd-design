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
 * This is the /lab/clouds reference cloud ported into the global background: a
 * SINGLE drei <Cloud> on a lit <MeshLambertMaterial>, sculpted by the lab's
 * light rig (a bright overhead key + two warm red rims) and framed from a 3/4
 * above-front camera. Values were tuned live in /lab/clouds and are now baked
 * as constants below (no leva panel here — tune in the lab, copy numbers back).
 *
 * Render strategy (see docs/cloud-rendering-research.md §9) is unchanged from
 * the previous cloud and deliberately diverges from the lab:
 * - frameloop="demand": no free-running rAF. The cloud is static (speed=0), so
 *   we only paint on change — scroll parallax, the first mount frames (drei
 *   builds geometry + loads the texture over several frames), tab re-show, and
 *   WebGL context restore. (The lab auto-rotates on a continuous loop; here the
 *   cloud instead drifts vertically with page scroll via <ParallaxRig>.)
 * - Transparent canvas (alpha): the cloud composites over the DOM sky — the
 *   flat #62abff fill + grain stay in <Background/>. (The lab paints a drei
 *   <Sky>; we keep the confirmed flat sky, so no <Sky> here.)
 * - Self-hosted sprite texture (/textures/cloud-puff.png) — a LOCAL COPY of
 *   drei's detailed cloud sprite (the one the lab gets from its CDN default),
 *   not hit at runtime (reliability/offline/privacy mandate, §9). It must be a
 *   detailed painted puff: the old /textures/cloud.png was a featureless radial
 *   blob, which is why the cloud rendered as a washed-out blur with no form.
 * - antialias ON and dpr up to 2 (was off/1.5) so the sprite detail isn't
 *   softened on retina — this matches the lab's crisp render. Single batched
 *   <Clouds> draw, no shadows; still desktop-only (gated ≤768px), so affordable.
 * - frustumCulled={false} on <Clouds>: the internal InstancedMesh has a stale
 *   bounding sphere under parallax, which would cull the whole batch and make
 *   the cloud vanish on scroll. One batched mesh, so always-drawing is cheap.
 * - Tone mapping is left at R3F's default (ACES), matching the lab — the bright
 *   key light carries the white, so the old NoToneMapping override (needed by
 *   the previous unlit MeshBasicMaterial path) is gone.
 *
 * Context-loss resilience: we rely on THREE.WebGLRenderer's BUILT-IN
 * webglcontextlost/restored handling — no manual preventDefault() (a documented
 * anti-pattern that leaks across Fast Refresh). <ContextWatchdog> only repaints
 * on restore and remounts the <Canvas> if a real driver reset never restores.
 */

// Baked cloud values — these were dialled in live on /lab/clouds and frozen
// here (the dev leva panel is gone). speed=0 is deliberate: the cloud is static
// for demand-render (a non-zero speed would only churn on scroll-driven
// invalidates, morphing the cloud as you scroll). To re-tune, play in
// /lab/clouds and copy the numbers back.
const CLOUD = {
  seed: 1,
  segments: 20,
  volume: 6,
  opacity: 0.8,
  fade: 10,
  growth: 4,
  speed: 0,
  color: "white",
} as const;
const BOUNDS: [number, number, number] = [6, 1, 1];
const RANGE = 100;

// Baked camera. The cloud is a static billboard, so its sense of 3D form comes
// almost entirely from the VIEW ANGLE catching the overhead key light's
// bright-top→shadow-bottom gradient — a 3/4 above-front view reads dimensional.
const CAMERA = { position: [0, 11, 18] as [number, number, number], fov: 50 };

// World units of downward y-shift across a full page scroll.
const PARALLAX = 3;

/**
 * Points the camera at the cloud. Holds the baked CAMERA constant and lookAt
 * the origin so the cloud stays centred. Demand mode, so invalidate() once to
 * paint the initial frame.
 */
function CameraRig({
  x,
  y,
  z,
  fov,
}: {
  x: number;
  y: number;
  z: number;
  fov: number;
}) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    // Mutating the live THREE camera is the idiomatic R3F pattern; the
    // immutability rule doesn't model it, so scope a disable to this effect.
    /* eslint-disable react-hooks/immutability */
    camera.position.set(x, y, z);
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      (camera as THREE.PerspectiveCamera).fov = fov;
    }
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    /* eslint-enable react-hooks/immutability */
    invalidate();
  }, [camera, invalidate, x, y, z, fov]);

  return null;
}

/** Drives the cloud's vertical parallax from global page scroll. */
function ParallaxRig({
  groupRef,
}: {
  groupRef: React.RefObject<Group | null>;
}) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const base = groupRef.current?.position.y ?? 0;

    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      scrub: true,
      onUpdate: (self) => {
        const g = groupRef.current;
        if (g) {
          g.position.y = base - self.progress * PARALLAX;
          invalidate();
        }
      },
    });

    return () => st.kill();
  }, [groupRef, invalidate]);

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
  const groupRef = useRef<Group | null>(null);
  // Bumping this remounts the <Canvas> with a fresh GL context — last resort
  // when a lost context never restores. See <ContextWatchdog>.
  const [canvasKey, setCanvasKey] = useState(0);
  const remount = useCallback(() => setCanvasKey((k) => k + 1), []);

  return (
    <Canvas
      key={canvasKey}
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: CAMERA.position, fov: CAMERA.fov }}
      style={{ position: "absolute", inset: 0 }}
    >
      {/* Lab light rig: a bright overhead key sculpts the white form, two warm
          red rims tint the sides. Lit MeshLambertMaterial, so these matter. */}
      <ambientLight intensity={Math.PI / 1.5} />
      <spotLight position={[0, 40, 0]} decay={0} distance={45} penumbra={1} intensity={100} />
      <spotLight position={[-20, 0, 10]} color="red" angle={0.15} decay={0} penumbra={-1} intensity={30} />
      <spotLight position={[20, -10, 10]} color="red" angle={0.2} decay={0} penumbra={-1} intensity={20} />

      <Clouds
        material={THREE.MeshLambertMaterial}
        texture="/textures/cloud-puff.png"
        limit={400}
        range={RANGE}
        frustumCulled={false}
      >
        {/* Wrapped in a group so <ParallaxRig> can shift it on scroll without
            fighting drei's per-instance transforms. */}
        <group ref={groupRef}>
          <Cloud {...CLOUD} bounds={BOUNDS} />
        </group>
      </Clouds>

      <CameraRig
        x={CAMERA.position[0]}
        y={CAMERA.position[1]}
        z={CAMERA.position[2]}
        fov={CAMERA.fov}
      />
        <ParallaxRig groupRef={groupRef} />
      <InvalidateOnReady />
      <ContextWatchdog onUnrecoverable={remount} />
    </Canvas>
  );
}

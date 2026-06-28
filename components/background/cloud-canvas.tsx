"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Cloud, Clouds } from "@react-three/drei";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Group } from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { CloudSpec } from "./cloud-specs";

/**
 * Volumetric cloud field (Three.js / R3F + drei <Clouds>).
 *
 * This is the /lab/clouds reference cloud ported into the global background:
 * lit drei <Cloud>s on a <MeshLambertMaterial>, framed from a 3/4 above-front
 * camera. Lighting is a white directional key + ambient (CLOUD_THEME) — chosen
 * over the lab's positioned spotlights so every cloud is lit identically
 * wherever it's placed (uniformly white, no position tint) and so theme modes
 * (evening/night) drop in as light-colour swaps. The look was tuned in
 * /lab/clouds and baked below (no leva here). Each hero cloud is anchored to a
 * screen spot via NDC (top-right corner + the two rock bases) by
 * <CloudPlacement>. More clouds/sections to come — this is the hero set.
 *
 * Render strategy (see docs/cloud-rendering-research.md §9) is unchanged from
 * the previous cloud and deliberately diverges from the lab:
 * - frameloop="demand": no free-running rAF. We paint on change — scroll
 *   parallax, the first mount frames (drei builds geometry + loads the texture
 *   over several frames), tab re-show, WebGL context restore — plus a THROTTLED
 *   ~30fps pump (<MorphRig>) that drives the clouds' slow living morph without a
 *   second rAF (it rides GSAP's ticker, which the browser parks on hidden tabs).
 *   (The lab auto-rotates on a continuous loop; here the field instead translates
 *   vertically with page scroll via <ScrollAnchorRig>, so clouds move with the
 *   document rather than staying pinned to the viewport.)
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

// Shared cloud look (tuned in /lab/clouds; the dev leva panel is gone). Size,
// seed and placement are per-cloud in the specs. `speed` is small + non-zero so
// the puffs slowly morph (lively, not churning); <MorphRig> pumps the demand
// loop at ~30fps so that morph actually advances. To re-tune the look, play in
// /lab/clouds.
const CLOUD = {
  segments: 20,
  opacity: 0.8,
  fade: 10,
  growth: 4,
  speed: 0.25,
  color: "white",
} as const;
const RANGE = 100;

// Cloud placements (NDC/dist/size) live in cloud-specs.ts — see CloudSpec.

// Baked camera — a 3/4 above-front view; the angle plus the sprite's own
// painted shading is what makes the billboards read as dimensional.
const CAMERA = { position: [0, 11, 18] as [number, number, number], fov: 50 };

// Cloud lighting as a THEME MAP. Only directional + ambient lights — NO
// positioned/spot lights — so a cloud is lit identically wherever it sits
// (white everywhere; the old red position-tint is gone). That position-
// independence is also what makes theming clean: a mode is just light
// colours/intensities (+ the sky colour, which actually lives in <Background/>;
// mirrored here for reference). Only `day` exists today — `evening` (warm gold
// key) and `night` (dim cool moonlight) drop in here later with no canvas
// changes. The key's `position` is a DIRECTION (light → origin), not a place,
// so it has no distance falloff.
const CLOUD_THEME = {
  day: {
    sky: "#62abff",
    ambient: { color: "#ffffff", intensity: 1.5 },
    key: {
      color: "#ffffff",
      intensity: 2.6,
      position: [0, 20, 12] as [number, number, number],
    },
  },
} as const;
const THEME = CLOUD_THEME.day;

// Reference depth (world units along the camera ray) for the scroll math. The
// hero clouds all sit here, so the scroll→world conversion below is exact for
// them (a cloud at this depth tracks page scroll 1:1, staying welded to the
// rocks). Clouds at other depths get a subtle parallax, which is fine.
const REF_DIST = 22;

/** NDC (z=0.5) → world point walked `dist` along the camera ray. */
function placeOnRay(
  camera: THREE.Camera,
  ndcX: number,
  ndcY: number,
  dist: number,
  out: THREE.Vector3,
) {
  out.set(ndcX, ndcY, 0.5).unproject(camera);
  out.sub(camera.position).normalize().multiplyScalar(dist).add(camera.position);
  return out;
}

const _vTop = new THREE.Vector3();
const _vBot = new THREE.Vector3();
/**
 * World-Y span of the full viewport at REF_DIST — the conversion factor between
 * scroll pixels and cloud world translation. One viewport of scroll moves the
 * field by exactly this much, so a cloud at REF_DIST tracks the page 1:1.
 */
function viewportWorldHeight(camera: THREE.Camera) {
  placeOnRay(camera, 0, 1, REF_DIST, _vTop);
  placeOnRay(camera, 0, -1, REF_DIST, _vBot);
  return _vTop.y - _vBot.y;
}

/**
 * Anchors each cloud to its target screen position. For each CloudSpec it
 * unprojects the NDC through the camera to a ray, walks `dist` down that ray,
 * and writes the world point to the cloud's group — so the cloud sits at that
 * screen spot at any aspect. `anchorVh` then pushes it down the world by that
 * many viewports, so section-N clouds start off-screen-below and <ScrollAnchorRig>
 * lifts them into view at the right scroll. Recomputes on resize; demand mode,
 * so invalidate() to paint. (Mutating group.position via a ref is fine — only
 * `camera` would trip the immutability rule, and we only read it.)
 */
function CloudPlacement({
  clouds,
  cloudRefs,
}: {
  clouds: CloudSpec[];
  cloudRefs: React.RefObject<(Group | null)[]>;
}) {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const vwh = viewportWorldHeight(camera);
    const v = new THREE.Vector3();
    clouds.forEach((c, i) => {
      const g = cloudRefs.current[i];
      if (!g) return;
      placeOnRay(camera, c.ndc[0], c.ndc[1], c.dist, v);
      g.position.set(v.x, v.y - c.anchorVh * vwh, v.z);
    });
    invalidate();
  }, [clouds, camera, width, height, invalidate, cloudRefs]);

  return null;
}

/**
 * Scroll anchoring (approach C): translate the whole cloud field UP in world
 * space as the page scrolls, so clouds move with the document instead of being
 * pinned to the viewport. The conversion (scroll px → world units) is calibrated
 * to REF_DIST, so a cloud at that depth tracks scroll exactly 1:1 — the hero's
 * rock-base clouds stay welded to the cliffs the whole way up, and each section's
 * clouds (anchorVh) rise into frame as you reach them.
 */
function ScrollAnchorRig({
  groupRef,
}: {
  groupRef: React.RefObject<Group | null>;
}) {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const worldPerPx = viewportWorldHeight(camera) / window.innerHeight;

    const apply = (scroll: number) => {
      const g = groupRef.current;
      if (!g) return;
      g.position.y = scroll * worldPerPx;
      invalidate();
    };

    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      scrub: true,
      onUpdate: (self) => apply(self.scroll()),
    });

    // Seed the position for a load that restores mid-page (scrub fires lazily).
    apply(window.scrollY || 0);

    return () => st.kill();
    // width/height: recompute worldPerPx when the viewport (and thus the world
    // height at REF_DIST) changes.
  }, [groupRef, camera, width, height, invalidate]);

  return null;
}

/**
 * Living-morph pump. The clouds carry a small `speed`, but drei advances that
 * morph inside a useFrame that only runs when a frame is requested — and we
 * render on demand. So we request frames on a THROTTLED cadence (~30fps; a slow
 * billow needs no more) off GSAP's ticker — the same one Lenis drives, so there
 * is still no second rAF loop. The browser parks rAF on hidden tabs, so this
 * idles automatically when the page isn't visible. Desktop-gated upstream, and
 * reduced-motion never mounts the canvas, so the steady repaint is affordable.
 */
function MorphRig() {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const STEP = 1 / 30; // seconds between repaints
    let last = 0;
    // gsap.ticker passes elapsed time in seconds; throttle to STEP.
    const tick = (time: number) => {
      if (time - last >= STEP) {
        last = time;
        invalidate();
      }
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [invalidate]);

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

export default function CloudCanvas({ clouds }: { clouds: CloudSpec[] }) {
  const fieldRef = useRef<Group | null>(null);
  const cloudRefs = useRef<(Group | null)[]>([]);
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
      // Aim the static camera at the origin once, before the first frame, so
      // <CloudPlacement>'s unproject reads a settled view matrix.
      onCreated={({ camera }) => {
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
      }}
      // pointer-events:none is REQUIRED here: R3F sets the <canvas> to
      // pointer-events:auto (it manages its own 3D pointer events), which
      // overrides the wrapper's `pointer-events-none`. Without this, the
      // full-viewport front canvas (z-[1]) swallows every pointermove and the
      // hero's grass-rock hover (rock-hover.tsx, listening on [data-hero])
      // never fires. The clouds are purely decorative, so no interaction is lost.
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {/* Position-independent light rig (see CLOUD_THEME): a white directional
          key + ambient fill light every cloud identically, wherever it sits, so
          they're uniformly white with no position-based tint. Theme-swappable. */}
      <ambientLight color={THEME.ambient.color} intensity={THEME.ambient.intensity} />
      <directionalLight
        color={THEME.key.color}
        intensity={THEME.key.intensity}
        position={THEME.key.position}
      />

      <Clouds
        material={THREE.MeshLambertMaterial}
        texture="/textures/cloud-puff.png"
        limit={400}
        range={RANGE}
        frustumCulled={false}
      >
        {/* <ScrollAnchorRig> translates the whole field on scroll so clouds move
            with the page; each cloud sits at its own screen-anchored position
            inside it (set by <CloudPlacement>). */}
        <group ref={fieldRef}>
          {clouds.map((c, i) => (
            <group
              key={c.key}
              ref={(el) => {
                cloudRefs.current[i] = el;
              }}
            >
              <Cloud {...CLOUD} seed={c.seed} bounds={c.bounds} volume={c.volume} />
            </group>
          ))}
        </group>
      </Clouds>

      <CloudPlacement clouds={clouds} cloudRefs={cloudRefs} />
      <ScrollAnchorRig groupRef={fieldRef} />
      <MorphRig />
      <InvalidateOnReady />
      <ContextWatchdog onUnrecoverable={remount} />
    </Canvas>
  );
}

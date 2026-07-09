"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { useQuality } from "@/lib/perf/use-quality";
import { getQualityConfig } from "@/lib/perf/quality-store";
import { makeCappedInvalidate } from "@/lib/perf/capped-invalidate";
import {
  cardAngle,
  CARD_BORDER,
  CARD_HEIGHT,
  CARD_RADIUS,
  CARD_WIDTH,
  FRAME_HEIGHT,
  PROJECTS,
  REST_CENTER_INDEX,
  WHEEL_PIVOT_Y,
  WHEEL_RADIUS,
  WHEEL_SWEEP_DEG,
} from "./showcase-spec";
import {
  getWheelProgress,
  subscribeWheelProgress,
} from "./showcase-scroll-state";

/**
 * Project-showcase wheel — WebGL layer (Three.js / R3F). The fan of textured
 * card planes, drawn in WebGL at parity with the DOM arc (showcase-card.tsx).
 * Built up in phases: the static fan (P1), scroll rotation (P2, WheelScrollRig),
 * the cloth vertex warp (P3, ClothRig + the displacement in CARD_VERTEX), and
 * the fly-in reveal (P4) — all on the same meshes.
 *
 * Geometry (single source of truth: showcase-spec.ts): every card plane is a
 * child of one WheelGroup positioned at the shared pivot, WHEEL_RADIUS px above
 * which the card centres sit. Each card group is rotated by −cardAngle(i) so the
 * fan matches the DOM `rotate()` exactly (CSS clockwise = −Z in a Y-up world).
 * Phase 2 will simply spin the WheelGroup.
 *
 * Coordinate frame: an ORTHOGRAPHIC camera at zoom 1, so 1 world unit = 1 CSS
 * pixel with the origin at the canvas centre (R3F's ortho default). The canvas
 * fills the whole SECTION and the frame is centred in the section, so the frame
 * centre coincides with the world origin — a card at frame (fx, fy) maps to world
 * (fx − FRAME_W/2, −(fy − FRAME_H/2)). Card overflow past the 1512 frame shows
 * exactly as the DOM fan's does (the section, not the frame, is the clip).
 *
 * House rules (heavy-effect contract, CLAUDE.md):
 * - frameloop="demand": no private rAF. Phase 1 is static, so after the textures
 *   decode (InvalidateOnReady pumps a burst) it paints nothing until it changes —
 *   idles to zero. Motion phases will invalidate() off the shared Lenis/GSAP tick.
 * - dpr capped at the tier's showcaseDprMax (≤ 1.5); registered in lib/perf/tiers.ts.
 * - SSR-safe: mounted via next/dynamic({ ssr:false }) behind the eligibility gate
 *   in showcase-scene.tsx; the DOM arc is the fallback.
 * - Context-loss: rely on THREE's built-in handling; <ContextWatchdog> only
 *   repaints on restore and remounts the <Canvas> if a real reset never restores.
 *   (Mirrors components/background/cloud-canvas.tsx; kept local for now.)
 */

const DEG2RAD = Math.PI / 180;

// Total wheel rotation across the pinned scroll (radians). At progress p the
// WheelGroup turns p × this, bringing successive cards to the upright centre.
const WHEEL_SWEEP_RAD = WHEEL_SWEEP_DEG * DEG2RAD;

// Pivot in world space: frame (WHEEL_PIVOT_X, WHEEL_PIVOT_Y) with the frame
// centred on the origin. x is the frame centre (→ 0); y flips (screen-down →
// world-up) and drops far below the viewport.
const PIVOT_WORLD_Y = -(WHEEL_PIVOT_Y - FRAME_HEIGHT / 2); // ≈ −2611

// Tiny per-card depth so the fan stacks centre-foremost (largest z = nearest to
// an ortho camera looking down −z). Symmetric neighbours tie and fall back to
// source order — good enough for the static fan; revisited if a phase needs it.
const Z_STEP = 1;

// ── Cloth warp (Phase 3) — material registry ──────────────────────────────────
// <ClothRig> drives the bend by mutating each card material's `uAmp` (0 = flat →
// 1 = full bend) and `uTime` (travelling-wave phase) uniforms every tick. It must
// mutate the MATERIAL's uniforms, not the object passed to <shaderMaterial>:
// R3F CLONES that prop, so a shared original never reaches the shader (verified —
// this was the Phase-3 wiring bug that left the cards flat). Each CardMesh
// registers its live material here on mount.
const cardMaterials = new Set<THREE.ShaderMaterial>();

// ── Card material ────────────────────────────────────────────────────────────
// A textured plane with rounded corners, a 1.5px white border, and the Figma
// top→bottom dark scrim, plus the CLOTH WARP: the vertex stage bends the plane
// (Phase 3) and the fragment SHADES the bend so it reads under the flat ortho
// camera (ortho ignores depth, so a pure Z-curl would be invisible — the shading
// from the curved surface's normal is what conveys the 3D bend). object-cover
// crops the image to the card aspect. A fixed 1px AA edge (no fwidth, so it
// compiles cleanly regardless of GLSL version).
//
// Cloth look constants (px / unitless), tuned by eye like the clouds' CLOUD block:
//   Z curl 44px drives the SHADING (via the normal); a small 10px in-plane ripple
//   gives visible deformation; shade contrast 0.4 darkens the troughs, sheen 0.14
//   brightens the crests. At uAmp 0 the plane is flat (normal +Z) so the card is
//   pixel-identical to the static fan — the warp only exists while moving.
const CARD_VERTEX = /* glsl */ `
  uniform vec2 uSize;
  uniform float uAmp;
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  varying vec3 vNormal;

  // Cloth height field over the local plane point p (px, centred), returning the
  // height and its slope (for the normal). Two travelling sine waves = a broad
  // curl + a finer ripple; uSeed decorrelates the cards so they don't bend in
  // lockstep; uTime moves the waves while bending.
  float cloth(vec2 p, out float dzdx, out float dzdy) {
    float kx1 = 6.2831853 * 1.50 / uSize.x;  // ~1.5 waves across the width
    float ky1 = 6.2831853 * 0.55 / uSize.y;  // gentle diagonal
    float kx2 = 6.2831853 * 2.60 / uSize.x;  // finer ripple
    float ph1 = p.x * kx1 + p.y * ky1 + uTime * 2.1 + uSeed;
    float ph2 = p.x * kx2 - p.y * ky1 * 1.4 + uTime * 3.0 + uSeed * 1.7;
    float a1 = 1.0, a2 = 0.35;
    dzdx = a1 * cos(ph1) * kx1 + a2 * cos(ph2) * kx2;
    dzdy = a1 * cos(ph1) * ky1 + a2 * cos(ph2) * (-ky1 * 1.4);
    return a1 * sin(ph1) + a2 * sin(ph2);
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    float dzdx, dzdy;
    float z = cloth(position.xy, dzdx, dzdy);
    float zPx = uAmp * 95.0;              // Z curl amplitude (shading + persp foreshorten)
    pos.z += zPx * z;
    pos.x += uAmp * 38.0 * z;             // in-plane ripple (visible even under ortho)
    // Surface normal of the height field (flat → +Z when uAmp = 0).
    vNormal = normalize(vec3(-zPx * dzdx, -zPx * dzdy, 1.0));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const CARD_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vNormal;
  uniform sampler2D uTexture;
  uniform vec2 uSize;        // card px (w, h)
  uniform float uRadius;     // corner radius px
  uniform float uBorder;     // border px
  uniform vec3 uBorderColor;
  uniform float uTexAspect;  // texture w / h
  uniform float uScrimTop;   // black alpha at the top edge
  uniform float uScrimBottom;// black alpha at the bottom edge

  // Signed distance to a rounded rectangle (p from centre, b = half-size).
  float roundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    // object-cover: scale UVs about the centre so the image fills the card.
    float cardAspect = uSize.x / uSize.y;
    float k = uTexAspect / cardAspect;
    vec2 uv = vUv;
    if (k > 1.0) uv.x = (uv.x - 0.5) / k + 0.5;  // texture wider → crop sides
    else         uv.y = (uv.y - 0.5) * k + 0.5;  // texture taller → crop top/bot
    vec3 col = texture2D(uTexture, uv).rgb;

    // Figma scrim: darker at the top, easing to lighter at the bottom.
    float t = 1.0 - vUv.y; // 0 at top, 1 at bottom
    col = mix(col, vec3(0.0), mix(uScrimTop, uScrimBottom, t));

    // Rounded-rect alpha + white border, both with a 1px antialiased edge.
    vec2 p = (vUv - 0.5) * uSize;
    float d = roundedBox(p, uSize * 0.5, uRadius);
    float aa = 1.0;
    float alpha = 1.0 - smoothstep(-aa * 0.5, aa * 0.5, d);
    float border = smoothstep(-uBorder - aa * 0.5, -uBorder + aa * 0.5, d);
    col = mix(col, uBorderColor, border);

    // Cloth shading — conveys the bend under the flat ortho camera. A flat card
    // has normal +Z (facing = 1) → light = 1.0 → unchanged from the static fan.
    // Curved areas turn away (facing < 1) → darkened troughs; a sideways sheen
    // (normal.x) brightens the crests for a fabric-like glint.
    float facing = clamp(vNormal.z, 0.0, 1.0);
    float light = mix(1.0 - 0.70, 1.0, facing) + 0.28 * vNormal.x;
    col *= light;

    gl_FragColor = vec4(col, alpha);
  }
`;

function makeCardUniforms(seed: number) {
  return {
    uTexture: { value: null as THREE.Texture | null },
    uSize: { value: new THREE.Vector2(CARD_WIDTH, CARD_HEIGHT) },
    uRadius: { value: CARD_RADIUS },
    uBorder: { value: CARD_BORDER },
    uBorderColor: { value: new THREE.Color("#ffffff") },
    uTexAspect: { value: CARD_WIDTH / CARD_HEIGHT },
    uScrimTop: { value: 0.1 }, // rgba(0,0,0,.1) at the top
    uScrimBottom: { value: 0.05 }, // rgba(0,0,0,.05) at the bottom
    uSeed: { value: seed }, // per-card phase offset (decorrelates the fan)
    uAmp: { value: 0 }, // driven per-material by ClothRig (see cardMaterials)
    uTime: { value: 0 },
  };
}

// ── Texture loading ───────────────────────────────────────────────────────────
/**
 * Load the (few) unique project images and repaint as each arrives. Demand mode
 * paints nothing on its own, so every decode calls invalidate(). Textures are
 * disposed on unmount. Returns a src→texture map (missing until loaded).
 */
function useCardTextures(): Record<string, THREE.Texture> {
  const invalidate = useThree((s) => s.invalidate);
  const [textures, setTextures] = useState<Record<string, THREE.Texture>>({});

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const unique = Array.from(new Set(PROJECTS.map((p) => p.src)));
    const loaded: Record<string, THREE.Texture> = {};
    let alive = true;

    unique.forEach((src) => {
      loader.load(src, (tex) => {
        if (!alive) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        loaded[src] = tex;
        setTextures({ ...loaded });
        invalidate();
      });
    });

    return () => {
      alive = false;
      Object.values(loaded).forEach((t) => t.dispose());
    };
  }, [invalidate]);

  return textures;
}

// ── Card mesh ──────────────────────────────────────────────────────────────────
function CardMesh({
  index,
  texture,
  segments,
}: {
  index: number;
  texture: THREE.Texture | undefined;
  /** Mesh subdivision [width, height] for the cloth warp (tiered at mount). */
  segments: [number, number];
}) {
  const invalidate = useThree((s) => s.invalidate);
  // Stable per-card uniforms object (created once). R3F builds/disposes the
  // <shaderMaterial> from JSX; we only mutate uniform VALUES through the material
  // ref inside the effect below — a ref touched solely in an effect is the
  // compiler-approved mutable escape hatch (same as the cloud rigs' group refs).
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const [uniforms] = useState(() => makeCardUniforms(index * 1.3));

  // Register this card's live material so ClothRig can drive its cloth uniforms
  // (R3F clones the uniforms prop, so the rig must reach the material directly).
  useEffect(() => {
    const mat = matRef.current;
    if (!mat) return;
    cardMaterials.add(mat);
    return () => {
      cardMaterials.delete(mat);
    };
  }, [texture]);

  // Feed the texture (and its true aspect for object-cover) once decoded, then
  // repaint (demand mode paints nothing on its own).
  useEffect(() => {
    const mat = matRef.current;
    if (!mat || !texture) return;
    mat.uniforms.uTexture.value = texture;
    const img = texture.image as { width?: number; height?: number } | undefined;
    if (img?.width && img?.height) {
      mat.uniforms.uTexAspect.value = img.width / img.height;
    }
    invalidate();
  }, [texture, invalidate]);

  // Don't paint a card until its texture exists (a null sampler reads black).
  if (!texture) return null;

  const z = -Math.abs(index - REST_CENTER_INDEX) * Z_STEP;
  return (
    <group rotation-z={-cardAngle(index) * DEG2RAD}>
      <mesh position={[0, WHEEL_RADIUS, z]}>
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT, segments[0], segments[1]]} />
        <shaderMaterial
          ref={matRef}
          attach="material"
          uniforms={uniforms}
          vertexShader={CARD_VERTEX}
          fragmentShader={CARD_FRAGMENT}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Wheel({
  groupRef,
  segments,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  segments: [number, number];
}) {
  const textures = useCardTextures();
  return (
    <group ref={groupRef} position={[0, PIVOT_WORLD_Y, 0]}>
      {PROJECTS.map((project, i) => (
        <CardMesh
          key={project.id}
          index={i}
          texture={textures[project.src]}
          segments={segments}
        />
      ))}
    </group>
  );
}

// Cloth drive tuning (see clothUniforms). SPEED_REF = the scroll speed
// (progress per second) that maps to full bend; RISE/FALL ease the amplitude so
// the cards snap into a bend and relax out of it with a trailing, cloth-like lag.
const CLOTH_SPEED_REF = 0.28;
const CLOTH_RISE = 0.35;
const CLOTH_FALL = 0.08;
const CLOTH_EPS = 0.002;

/**
 * Cloth warp driver (Phase 3). Renders nothing.
 *
 * Turns scroll SPEED into bend amplitude: each shared-ticker tick it reads the
 * wheel progress, derives how fast it's changing, eases `uAmp` toward that speed
 * (fast rise, slow fall → a trailing cloth lag), and advances `uTime` so the
 * waves travel while bending. Repaints through a capped invalidate.
 *
 * IDLES TO ZERO: once the bend has relaxed to flat AND the wheel is still, it
 * writes one final flat frame and then stops repainting entirely — the tick keeps
 * running (it's the shared GSAP ticker, cheap), but nothing is drawn until motion
 * resumes. This is the heavy-effect contract's "stop when nothing changes".
 * Rides the shared ticker (Lenis' rAF) — no private loop; parks on hidden tabs.
 */
function ClothRig() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const capped = makeCappedInvalidate(invalidate);
    const drive = (a: number, t: number) => {
      for (const m of cardMaterials) {
        m.uniforms.uAmp.value = a;
        m.uniforms.uTime.value = t;
      }
    };
    let amp = 0;
    let settled = true;
    let lastProgress = getWheelProgress();
    let lastTime = -1;

    // gsap.ticker passes elapsed seconds; skip the first tick (no baseline dt).
    const tick = (time: number) => {
      if (lastTime < 0) {
        lastTime = time;
        lastProgress = getWheelProgress();
        return;
      }
      const dt = Math.max(1e-3, time - lastTime);
      lastTime = time;
      const p = getWheelProgress();
      const speed = Math.abs(p - lastProgress) / dt; // progress per second
      lastProgress = p;

      // [PROTOTYPE DEBUG] force override to inspect the bend at a fixed amp.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const forced = (window as any).__forceCloth;
      const target =
        typeof forced === "number"
          ? forced
          : Math.min(1, speed / CLOTH_SPEED_REF);
      amp += (target - amp) * (target > amp ? CLOTH_RISE : CLOTH_FALL);

      if (amp < CLOTH_EPS && target < CLOTH_EPS) {
        // Settled: write one flat frame, then idle (stop repainting).
        if (!settled) {
          amp = 0;
          drive(0, time);
          capped();
          settled = true;
        }
        return;
      }
      settled = false;
      drive(amp, time);
      capped();
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      capped.cancel();
    };
  }, [invalidate]);
  return null;
}

/**
 * Scroll rotation rig (Phase 2). Subscribes to the shared progress store
 * (written by the DOM pin driver, showcase-scroll.tsx) and turns the whole
 * WheelGroup around the pivot — 0 = resting arc, WHEEL_SWEEP_RAD at the end.
 * Repaints through a capped invalidate (the demand canvas paints on change; the
 * cap throttles the up-to-120Hz scroll stream to the heavy-effect fps). Seeds
 * from the current progress on mount (covers a load restored mid-section).
 */
function WheelScrollRig({
  groupRef,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
}) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const capped = makeCappedInvalidate(invalidate);
    const apply = (progress: number) => {
      const g = groupRef.current;
      if (!g) return;
      g.rotation.z = progress * WHEEL_SWEEP_RAD;
      capped();
    };
    const unsubscribe = subscribeWheelProgress(apply);
    apply(getWheelProgress()); // seed
    return () => {
      unsubscribe();
      capped.cancel();
    };
  }, [groupRef, invalidate]);
  return null;
}

// ── Demand-mode helpers (mirror components/background/cloud-canvas.tsx) ─────────
/**
 * drei/three build geometry and decode textures over several frames, and our
 * frameloop is "demand", so a single mount frame can paint blank. Pump a short
 * rAF burst after mount (+ a few delayed nudges for slow decode), and repaint
 * when the tab becomes visible again.
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
 * WebGL context-loss safety net. THREE handles lost/restored internally; here we
 * only repaint after a restore (demand mode needs an explicit frame) and, if a
 * restore never arrives (unrecoverable driver reset), ask the parent to remount
 * the <Canvas> with a fresh context. No manual preventDefault() (an anti-pattern
 * that leaks across Fast Refresh).
 */
function ContextWatchdog({ onUnrecoverable }: { onUnrecoverable: () => void }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const canvas = gl.domElement;
    let mounted = true;
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;
    const onLost = () => {
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => {
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

export default function ShowcaseCanvas() {
  const { showcaseDprMax } = useQuality();
  const wheelRef = useRef<THREE.Group>(null);
  // [PROTOTYPE] camera model chosen by ?cloth=… (default persp). persp → the
  // curl foreshortens (3D poster bend); ortho → flat, bend reads via shading +
  // in-plane ripple only. Lets us A/B the two directions before committing.
  const [mode] = useState<"persp" | "ortho">(() =>
    new URLSearchParams(window.location.search).get("cloth") === "ortho"
      ? "ortho"
      : "persp",
  );
  // Mesh subdivision for the cloth warp — SNAPSHOT at mount (segments drive the
  // geometry; honouring a live tier step-down would rebuild all 12 meshes). Card
  // is taller than wide, so the height gets proportionally more segments.
  const [segments] = useState<[number, number]>(() => {
    const s = getQualityConfig().showcaseClothSegments;
    return [s, Math.round((s * CARD_HEIGHT) / CARD_WIDTH)];
  });
  // Bumping this remounts the <Canvas> with a fresh GL context — last resort when
  // a lost context never restores. See <ContextWatchdog>.
  const [canvasKey, setCanvasKey] = useState(0);
  const remount = useCallback(() => setCanvasKey((k) => k + 1), []);

  return (
    <Canvas
      key={`${canvasKey}-${mode}`}
      orthographic={mode === "ortho"}
      frameloop="demand"
      dpr={[1, showcaseDprMax]}
      gl={{ antialias: true, alpha: true }}
      camera={
        mode === "ortho"
          ? { position: [0, 0, 100], zoom: 1, near: 0.1, far: 1000 }
          : { position: [0, 0, 1800], fov: 28, near: 1, far: 5000 }
      }
      // [PROTOTYPE] persp: place the camera so the frustum height at the card
      // plane (z≈0) equals the canvas height → 1 world unit ≈ 1 CSS px, so the
      // arc still pixel-matches while the cloth Z-curl foreshortens. (Mutating
      // the camera in onCreated, not an effect — the same pattern the cloud
      // canvas uses to avoid the compiler's hook-immutability rule.)
      onCreated={(state) => {
        if (mode !== "persp") return;
        const cam = state.camera as THREE.PerspectiveCamera;
        const fovRad = (cam.fov * Math.PI) / 180;
        cam.position.set(0, 0, state.size.height / (2 * Math.tan(fovRad / 2)));
        cam.near = 1;
        cam.far = cam.position.z * 2;
        cam.updateProjectionMatrix();
      }}
      // The wrapper is pointer-events-none, but R3F sets the <canvas> itself to
      // pointer-events:auto; force it off so this full-section overlay never
      // swallows clicks meant for the DOM caption / CTA beneath it.
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <Wheel groupRef={wheelRef} segments={segments} />
      <WheelScrollRig groupRef={wheelRef} />
      <ClothRig />
      <InvalidateOnReady />
      <ContextWatchdog onUnrecoverable={remount} />
    </Canvas>
  );
}

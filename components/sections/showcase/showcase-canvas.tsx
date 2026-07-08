"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useQuality } from "@/lib/perf/use-quality";
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
} from "./showcase-spec";

/**
 * Project-showcase wheel — WebGL layer (Three.js / R3F). PHASE 1: the STATIC
 * fan, at parity with the DOM arc (showcase-card.tsx), rendered in WebGL so the
 * later phases can add scroll rotation (Phase 2), the cloth vertex warp
 * (Phase 3), and the fly-in reveal (Phase 4) on top of the same meshes.
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

// Pivot in world space: frame (WHEEL_PIVOT_X, WHEEL_PIVOT_Y) with the frame
// centred on the origin. x is the frame centre (→ 0); y flips (screen-down →
// world-up) and drops far below the viewport.
const PIVOT_WORLD_Y = -(WHEEL_PIVOT_Y - FRAME_HEIGHT / 2); // ≈ −2611

// Tiny per-card depth so the fan stacks centre-foremost (largest z = nearest to
// an ortho camera looking down −z). Symmetric neighbours tie and fall back to
// source order — good enough for the static fan; revisited if a phase needs it.
const Z_STEP = 1;

// ── Card material ────────────────────────────────────────────────────────────
// A textured plane with rounded corners, a 1.5px white border, and the Figma
// top→bottom dark scrim — the DOM card's look, in one unlit shader. object-cover
// crops the image to the card aspect. A fixed 1px AA edge (no fwidth, so it
// compiles cleanly regardless of GLSL version). Phase 3 extends the VERTEX stage
// of this same material with the cloth displacement.
const CARD_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CARD_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
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

    gl_FragColor = vec4(col, alpha);
  }
`;

function makeCardUniforms() {
  return {
    uTexture: { value: null as THREE.Texture | null },
    uSize: { value: new THREE.Vector2(CARD_WIDTH, CARD_HEIGHT) },
    uRadius: { value: CARD_RADIUS },
    uBorder: { value: CARD_BORDER },
    uBorderColor: { value: new THREE.Color("#ffffff") },
    uTexAspect: { value: CARD_WIDTH / CARD_HEIGHT },
    uScrimTop: { value: 0.1 }, // rgba(0,0,0,.1) at the top
    uScrimBottom: { value: 0.05 }, // rgba(0,0,0,.05) at the bottom
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
}: {
  index: number;
  texture: THREE.Texture | undefined;
}) {
  const invalidate = useThree((s) => s.invalidate);
  // Stable per-card uniforms object (created once). R3F builds/disposes the
  // <shaderMaterial> from JSX; we only mutate uniform VALUES through the material
  // ref inside the effect below — a ref touched solely in an effect is the
  // compiler-approved mutable escape hatch (same as the cloud rigs' group refs).
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const [uniforms] = useState(() => makeCardUniforms());

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
        <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT, 1, 1]} />
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

function Wheel() {
  const textures = useCardTextures();
  return (
    <group position={[0, PIVOT_WORLD_Y, 0]}>
      {PROJECTS.map((project, i) => (
        <CardMesh key={project.id} index={i} texture={textures[project.src]} />
      ))}
    </group>
  );
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
  // Bumping this remounts the <Canvas> with a fresh GL context — last resort when
  // a lost context never restores. See <ContextWatchdog>.
  const [canvasKey, setCanvasKey] = useState(0);
  const remount = useCallback(() => setCanvasKey((k) => k + 1), []);

  return (
    <Canvas
      key={canvasKey}
      orthographic
      frameloop="demand"
      dpr={[1, showcaseDprMax]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 100], zoom: 1, near: 0.1, far: 1000 }}
      // The wrapper is pointer-events-none, but R3F sets the <canvas> itself to
      // pointer-events:auto; force it off so this full-section overlay never
      // swallows clicks meant for the DOM caption / CTA beneath it.
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <Wheel />
      <InvalidateOnReady />
      <ContextWatchdog onUnrecoverable={remount} />
    </Canvas>
  );
}

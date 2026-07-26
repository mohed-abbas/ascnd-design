"use client";

import { useFrame, useThree } from "@react-three/fiber";
import {
  Center,
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  PerspectiveCamera,
  Text3D,
  useTexture,
} from "@react-three/drei";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import type { Group, Mesh } from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getQualityConfig } from "@/lib/perf/quality-store";
import { useMode } from "@/lib/theme/use-mode";
import { CROSSFADE, PALETTES } from "@/lib/theme/palette";
import { makeSkyBackdrop } from "@/lib/theme/sky-backdrop";
import {
  useSharedView,
  type SharedViewControls,
} from "@/components/canvas/use-shared-view";
import { FRONT_INDEX } from "@/components/canvas/indices";
import { CAMERA_Z, ROCK_Z, TILE_Z } from "./intro-depths";
import { setPlaneDprOverride } from "@/components/canvas/view-registry";
import {
  SHOT_BASE,
  SHOT_FRAME_RADIUS,
  SHOT_MAT_RATIO,
} from "@/components/sections/design-shots/shots-spec";

// Warm the local assets ASAP so the scene's ready-gate isn't waiting on a
// cold fetch (the rock cut-outs; the Environment HDR loads in its own Suspense
// so it never blocks the reveal — see the canvas below).
useTexture.preload("/rocks/left-rock.avif");
useTexture.preload("/rocks/right-rock.avif");
// The introV2 "shot" tiles (the necklace beads-to-be) refract through the glass,
// so they live in the scene too — warm them alongside the rocks.
for (const n of [2, 3, 4, 5, 6, 7, 8, 9]) useTexture.preload(`/shots/shot${n}.avif`);

/**
 * The welcome-intro WebGL stage. Reuses the proven /lab/glass setup (branch `dev`) — PERSPECTIVE
 * camera (z=10, fov=45, the cloud-canvas convention) at a small world scale, so
 * the liquid glass refracts/disperses richly (a flat-on orthographic view of huge
 * letters just shows the backdrop straight through and looks solid).
 *
 * <Intro> measures the DOM in pixels and converts to world units (1px ≈
 * 8.284/innerHeight world units at z=0), so positions/sizes still line up with
 * the hero. The canvas is TRANSPARENT — the DOM sky + clouds show through; only
 * the two rock planes (refraction source under 'a'/'d', pixel-matched over the
 * DOM rocks) and the glass live in the scene. The material's `background` — a
 * gradient texture of the real sky stops (lib/theme/sky-backdrop) — fills the
 * transmission where the scene is empty (open sky).
 *
 * Transforms are driven imperatively from <Intro>'s GSAP timeline via the shared
 * `anim` ref.
 *
 * RENDERING HOST (Phase 2, docs/canvas-consolidation-plan.md): this component no
 * longer owns a <Canvas>. It registers a single view on the shared FRONT plane
 * (components/canvas/, z-[61]) via useSharedView, passing the intro's r3f scene
 * as that view's `children`. The host wraps it in a drei <View> that scissors to
 * the `track` placeholder (a fixed inset-0 div in <Intro>'s DOM), sets this
 * view's tone mapping (NoToneMapping) at priority index-1, and paints it from the
 * single ticker-end advance pump — no private frameloop, no invalidate(). Paint
 * cadence is expressed through the registration (mode/fpsCap) + markDirty/
 * requestBurst; see the paint-policy block in the default export.
 */

export type GlassAnim = {
  x: number;
  y: number;
  scale: number;
  rotX: number;
  rotY: number;
  /** 0 = fully below the baseline clip (hidden), 1 = revealed at rest. */
  reveal: number;
  /** Glass material opacity — faded to 0 at the dock handoff, then unmounted. */
  opacity: number;
};

export type RockLayout = {
  src: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
};

/** Per-rock entrance state, driven by <Intro>'s timeline (the WebGL "slide"). */
export type RockEntry = {
  opacity: number;
  /** World-unit x offset added to the rock's resting position — seeded
   *  off-screen toward the rock's own side so it slides in from the edge. */
  xOffset: number;
  /** World-unit y offset added to the rock's resting position (settle). */
  yOffset: number;
};

/** Static per-tile config (introV2 shots): image, corner rounding, conveyor slot. */
export type TileLayout = {
  src: string;
  /** corner radius as a fraction of the tile's edge — drives the rounded mask. */
  radiusRatio: number;
  /** the tile's resting slot index into the arc (its conveyor phase + identity). */
  arc: number;
};

/**
 * The arc slot path in WORLD units (8 slots, far-L..far-R..return), measured
 * once by <Intro> from the DOM rotors. The conveyor rides a closed Catmull-Rom
 * through these, so the WebGL necklace matches the DOM collage exactly.
 */
export type ConveyorArc = { xs: number[]; ys: number[]; sizes: number[] };

/**
 * Per-tile state, driven imperatively by <Intro>'s timeline. Unlike the rocks
 * (which only slide + fade), each tile also travels scatter→necklace and grows/
 * shrinks between the two, so x/y/scale are absolute world values written every
 * frame by the timeline rather than offsets from a fixed rest.
 */
export type TileEntry = {
  opacity: number;
  /** world-space center */
  x: number;
  y: number;
  /** world-space edge length (the plane is a unit quad scaled by this). */
  scale: number;
};

export type IntroSceneProps = {
  /** The full-viewport (fixed inset-0) placeholder the shared FRONT <View>
   *  tracks. MUST stay exactly full-viewport or intro.tsx's px→world mapping
   *  (wpp = 8.284/innerHeight) desyncs — the scene would no longer line up with
   *  the DOM hero. */
  track: React.RefObject<HTMLElement | null>;
  anim: React.RefObject<GlassAnim>;
  rocks: RockLayout[];
  /** Per-rock entrance (opacity + settle), index-matched to `rocks`. */
  rockEntry: React.RefObject<RockEntry[]>;
  /** The introV2 shot tiles (image + corner rounding), index-matched to tileEntry. */
  tiles: TileLayout[];
  /** Per-tile state (opacity + world x/y/scale), driven by <Intro>'s timeline. */
  tileEntry: React.RefObject<TileEntry[]>;
  /** Arc slot path (world units) for the steady-state conveyor. */
  arc: ConveyorArc;
  /** Intro phase: glass + rocks mounted, view continuous "heavy". Off → steady state. */
  introActive: boolean;
  /** Run the steady-state conveyor (starts when the intro fly-in lands). */
  conveyor: boolean;
  /** Text3D `size` in WORLD units (≈ 4–5, matching the lab). */
  glassSize: number;
  /** Proportional scale (≤1) applied to the glass's absolute-world geometry
   *  (bevel/thickness/attenuation/distortion) so a small-viewport glyph keeps the
   *  same bevel-to-stroke ratio as the big desktop glyph. 1 on desktop. */
  glassGeomScale: number;
  /** World y the glass rests at (the welcome spot) — anchors the reveal clip. */
  restY: number;
  font?: string;
  /** Fired once the scene's local assets have loaded and a frame painted. */
  onReady?: () => void;
};

const FONT = "/fonts/product-sans-medium.typeface.json";

/**
 * Device-pixel ratio for the INTRO phase (KNOWN TRAP #3).
 *
 * Measured 2026-07-18 with per-context draw-call instrumentation on an M-series
 * 120Hz MacBook: the glass's MAIN-PASS fragments at canvas resolution — NOT the
 * MTM FBO the tiers tune — were the intro's boulder, and dpr × MSAA cost is
 * multiplicative. So the intro runs at dpr 1 (the moving refractive glass hides
 * the softness), then releases to the plane's [1,1.5] ceiling for the crisp
 * steady conveyor. MSAA is a PLANE-level context flag, not a per-view one — the
 * knob lives in components/canvas/plane-config.ts (front.antialias:false).
 */
const INTRO_DPR = 1;

// Camera + plane depths live in the LEAF module intro-depths.ts, shared with
// <Intro>. They must NOT be declared (or re-exported) here: <Intro> needs them
// at measure time, and importing a runtime value from this file puts three/drei
// into <Hero>'s static graph, undoing the dynamic() code-split. See
// intro-depths.ts for the full rationale.

// The scene's visible height at the z=0 plane. The telephoto fov is chosen so
// this is exactly 8.284 (matching <Intro>'s wpp = 8.284/innerHeight), so the
// viewport bottom sits at world y = -VIEW_WORLD_H/2. The glass slides up from
// below that edge, so its off-screen start is anchored here.
const VIEW_WORLD_H = 8.284;

/**
 * Local "studio" environment for the glass shine — a handful of <Lightformer>
 * rects baked into a static env cubemap (no network fetch, so the reflections
 * are present on the very first painted frame instead of popping in a beat
 * later). The bright rectangles reflect off the glass bevels/clearcoat as crisp
 * specular glints, which reads as glossy glass even under the telephoto camera
 * (a head-on view barely sweeps a broad HDR, but placed glints still catch).
 *
 * Exported so the /lab/glass sandbox (branch `dev`) renders the EXACT same
 * shine — it stays a faithful preview and passes tuning intensities here. The
 * defaults ARE the production values, so the intro calls `<GlassEnvironment />`
 * bare. `frames` defaults to 1, so the cubemap is rendered once (cheap); the lab
 * passes `Infinity` so slider changes re-bake live.
 */
export type GlassEnvProps = {
  /** scene.environmentIntensity — overall reflection strength. */
  environmentIntensity?: number;
  /** Broad front fill — lights the face + softens the whole outline. */
  frontFill?: number;
  /** Side/bottom fills — light the bevel "outline" from each direction. */
  leftFill?: number;
  rightFill?: number;
  bottomFill?: number;
  /** Bright glossy streaks (the "shine"). */
  keyGlint?: number;
  topRim?: number;
  /** Cubemap re-bake cadence. 1 = bake once (prod); Infinity = live (lab). */
  frames?: number;
};

export function GlassEnvironment({
  environmentIntensity = 3,
  frontFill = 0.05,
  leftFill = 1.7,
  rightFill = 1.7,
  bottomFill = 1.5,
  keyGlint = 4,
  topRim = 2.6,
  frames = 1,
}: GlassEnvProps = {}) {
  return (
    <Environment
      resolution={256}
      environmentIntensity={environmentIntensity}
      frames={frames}
    >
      {/* ── Surround fill ──────────────────────────────────────────────────
          The bevel edges (the glyph "outline") graze the env at the silhouette,
          so any DARK direction shows up as a dark outline there. A box of soft
          fills — front + left + right + bottom — gives every edge normal
          something bright to reflect, lighting the outline all the way round
          instead of only where the bright glints point. */}
      <Lightformer
        form="rect"
        intensity={frontFill}
        color="#cfe3ff"
        position={[0, 0, 9]}
        scale={[26, 26, 1]}
      />
      <Lightformer
        form="rect"
        intensity={leftFill}
        color="#dbe8ff"
        position={[-9, 0, 5]}
        scale={[6, 18, 1]}
      />
      <Lightformer
        form="rect"
        intensity={rightFill}
        color="#e9f2ff"
        position={[9, 0, 5]}
        scale={[6, 18, 1]}
      />
      <Lightformer
        form="rect"
        intensity={bottomFill}
        color="#eaf2ff"
        position={[0, -8, 5]}
        scale={[18, 5, 1]}
      />
      {/* ── Bright glints (the glossy "shine") ────────────────────────────── */}
      {/* Key glint — upper-right: the main bright streak across the glyphs. */}
      <Lightformer
        form="rect"
        intensity={keyGlint}
        color="#ffffff"
        position={[5, 5, 6]}
        scale={[8, 10, 1]}
      />
      {/* Top rim — a thin bright bar that rides the upper bevel edge. */}
      <Lightformer
        form="rect"
        intensity={topRim}
        color="#ffffff"
        position={[0, 7, 3]}
        scale={[12, 2, 1]}
      />
    </Environment>
  );
}

function Rocks({
  rocks,
  rockEntry,
}: {
  rocks: RockLayout[];
  rockEntry: React.RefObject<RockEntry[]>;
}) {
  const maps = useTexture(rocks.map((r) => r.src));
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);

  // Drive the entrance imperatively from the shared ref (same pattern as Glass).
  // Start hidden (opacity 0 below) and let <Intro>'s drift tween fade + settle.
  useFrame(() => {
    const entries = rockEntry.current;
    if (!entries) return;
    rocks.forEach((r, i) => {
      const e = entries[i];
      if (!e) return;
      const mat = mats.current[i];
      if (mat) mat.opacity = e.opacity;
      const mesh = meshes.current[i];
      if (mesh) {
        mesh.position.x = r.cx + e.xOffset;
        mesh.position.y = r.cy + e.yOffset;
      }
    });
  });

  return (
    <group>
      {rocks.map((r, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          position={[r.cx, r.cy, ROCK_Z]}
        >
          <planeGeometry args={[r.w, r.h]} />
          <meshBasicMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            map={maps[i] as THREE.Texture}
            transparent
            toneMapped={false}
            opacity={0}
          />
        </mesh>
      ))}
    </group>
  );
}

// White rounded-rect on transparent, used as each tile's alphaMap so the square
// plane reads as a rounded card. Radius is a fraction of the edge, so it scales
// with the plane (corners stay in ratio as the tile grows into its slot).
function makeRoundedAlpha(radiusRatio: number): THREE.Texture {
  // 512 (not 256): the shot now rounds to the full frame radius, ~3.7× the old
  // near-square corner, so the arc must be sampled finely enough to stay smooth
  // when the tile is magnified into the big centre slot.
  const S = 512;
  const r = Math.min(0.5, radiusRatio) * S;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(S - r, 0);
    ctx.arcTo(S, 0, S, r, r);
    ctx.lineTo(S, S - r);
    ctx.arcTo(S, S, S - r, S, r);
    ctx.lineTo(r, S);
    ctx.arcTo(0, S, 0, S - r, r);
    ctx.lineTo(0, r);
    ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// Rounded-rect path helper for the glass-frame canvas below.
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// The WebGL twin of the DOM tile's liquid-glass mat (design-shots.tsx / the
// navbar "menu" glass): a rounded frame drawn on transparent — a faint white
// mat ring, a soft inner sheen, and a crisp white edge — with a transparent
// WINDOW punched out for the shot. It renders on a quad LARGER than the shot
// (scaled up by the mat), so the frame wraps the shot as an OUTER border with
// the mat ring sitting outside the shot's edge (matching the DOM). Both ratios
// are of the FRAME quad's edge: `outerRadiusRatio` = the (rounder) outer corner,
// `windowInsetRatio` = how far in from the frame edge the shot window sits, and
// `windowRadiusRatio` = the window's corner (= the shot's near-square corner, so
// the frame is deliberately NOT concentric with it).
function makeGlassFrame(
  outerRadiusRatio: number,
  windowInsetRatio: number,
  windowRadiusRatio: number,
): THREE.Texture {
  // 512 to match makeRoundedAlpha — the frame's rounded outer edge and window
  // corner scale up into the centre slot and would otherwise stair-step.
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const rOut = Math.min(0.5, outerRadiusRatio) * S;
    const inset = windowInsetRatio * S;
    const rIn = Math.max(0, windowRadiusRatio * S); // = the shot's own corner
    const border = Math.max(1, (1 / SHOT_BASE) * S); // ≈1px at BASE, scales down

    // Mat fill across the whole rounded rect (white/10, like the DOM bg).
    roundRectPath(ctx, 0.5, 0.5, S - 1, S - 1, rOut);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();

    // Inner sheen — a soft white glow hugging the inside of the outer edge (the
    // navbar's inset white shadow). Clipped to the frame so it stays inside.
    ctx.save();
    roundRectPath(ctx, 0.5, 0.5, S - 1, S - 1, rOut);
    ctx.clip();
    ctx.shadowColor = "rgba(255,255,255,0.55)";
    ctx.shadowBlur = inset * 1.3;
    roundRectPath(ctx, -3, -3, S + 6, S + 6, rOut);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.stroke();
    ctx.restore();

    // Crisp outer edge (white/45, like border-white/30-45).
    roundRectPath(ctx, border / 2, border / 2, S - border, S - border, rOut);
    ctx.lineWidth = border;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.stroke();

    // Punch the transparent window the shot shows through (its edge = the shot).
    ctx.globalCompositeOperation = "destination-out";
    roundRectPath(ctx, inset, inset, S - 2 * inset, S - 2 * inset, rIn);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// The frame quad is bigger than the shot by the mat on every side. F is that
// scale-up factor; the frame texture's radius/window ratios are expressed
// against this larger quad (so they line up with the shot at its edge).
const FRAME_SCALE = 1 + 2 * SHOT_MAT_RATIO;

/**
 * The introV2 shot tiles — textured planes behind the glass (so it refracts
 * them), the WebGL twin of the hero's design-shots collage. Each is a unit quad
 * scaled/positioned every frame from the shared `tileEntry` ref, which <Intro>'s
 * timeline blooms in place, then flies along a curved path onto the necklace arc
 * where the DOM collage crossfades in underneath (same handoff as the rocks).
 * The square image is centre-cropped (object-cover) via the texture transform.
 */
function Tiles({
  tiles,
  tileEntry,
  fieldRef,
}: {
  tiles: TileLayout[];
  tileEntry: React.RefObject<TileEntry[]>;
  /** The field group whose y <ScrollRig> translates so the arc scrolls 1:1. */
  fieldRef: React.RefObject<Group | null>;
}) {
  const maps = useTexture(tiles.map((t) => t.src));
  const alphas = useMemo(
    () => tiles.map((t) => makeRoundedAlpha(t.radiusRatio)),
    [tiles],
  );
  // The liquid-glass mat frame texture per tile. The frame quad is scaled up by
  // FRAME_SCALE, so every ratio is against that larger quad: the outer corner is
  // SHOT_FRAME_RADIUS, the window sits inset by the mat, and the window corner
  // matches the shot's radius — which now equals the frame's, so the shot rounds
  // to match the glass border.
  const frameEdge = SHOT_BASE * FRAME_SCALE;
  const frames = useMemo(
    () =>
      tiles.map((t) =>
        makeGlassFrame(
          SHOT_FRAME_RADIUS / frameEdge,
          SHOT_MAT_RATIO / FRAME_SCALE,
          t.radiusRatio / FRAME_SCALE,
        ),
      ),
    [tiles, frameEdge],
  );
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const frameMats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const frameMeshes = useRef<(THREE.Mesh | null)[]>([]);

  // Centre-crop each texture to a square (object-cover) and tag it sRGB so the
  // shot colours read true under NoToneMapping.
  useLayoutEffect(() => {
    maps.forEach((m) => {
      const img = m.image as { width?: number; height?: number } | undefined;
      if (!img?.width || !img?.height) return;
      const a = img.width / img.height;
      if (a >= 1) {
        m.repeat.set(1 / a, 1);
        m.offset.set((1 - 1 / a) / 2, 0);
      } else {
        m.repeat.set(1, a);
        m.offset.set(0, (1 - a) / 2);
      }
      m.colorSpace = THREE.SRGBColorSpace;
      m.needsUpdate = true;
    });
  }, [maps]);

  // Per-tile local pose (fly-in / conveyor). The page-scroll offset is applied
  // ONCE to the whole field group (see <ScrollRig>), so it's not added here. The
  // frame quad tracks the shot exactly (same pose), sitting a hair closer to the
  // camera so it draws over the shot's edge.
  useFrame(() => {
    const entries = tileEntry.current;
    if (!entries) return;
    tiles.forEach((_, i) => {
      const e = entries[i];
      if (!e) return;
      const mat = mats.current[i];
      if (mat) mat.opacity = e.opacity;
      const mesh = meshes.current[i];
      if (mesh) {
        mesh.position.set(e.x, e.y, TILE_Z);
        mesh.scale.set(e.scale, e.scale, 1);
      }
      const fMat = frameMats.current[i];
      if (fMat) fMat.opacity = e.opacity;
      const fMesh = frameMeshes.current[i];
      if (fMesh) {
        // Bigger than the shot by the mat on every side (outer border).
        fMesh.position.set(e.x, e.y, TILE_Z + 0.01);
        fMesh.scale.set(e.scale * FRAME_SCALE, e.scale * FRAME_SCALE, 1);
      }
    });
  });

  return (
    <group ref={fieldRef}>
      {tiles.map((_, i) => (
        <group key={i}>
          {/* The shot (full-size, rounded). */}
          <mesh
            ref={(m) => {
              meshes.current[i] = m;
            }}
            position={[0, 0, TILE_Z]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              ref={(m) => {
                mats.current[i] = m;
              }}
              map={maps[i] as THREE.Texture}
              alphaMap={alphas[i]}
              transparent
              toneMapped={false}
              opacity={0}
            />
          </mesh>
          {/* The liquid-glass mat frame, drawn just in front. */}
          <mesh
            ref={(m) => {
              frameMeshes.current[i] = m;
            }}
            position={[0, 0, TILE_Z + 0.01]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              ref={(m) => {
                frameMats.current[i] = m;
              }}
              map={frames[i]}
              transparent
              toneMapped={false}
              depthWrite={false}
              opacity={0}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Closed Catmull-Rom through a numeric ring — smooth everywhere incl. the seam.
// Ported from design-shots-reveal so the WebGL conveyor traces the SAME path as
// the DOM collage. t is in [0, n).
function crClosed(arr: number[], t: number): number {
  const n = arr.length;
  const i = Math.floor(t);
  const f = t - i;
  const a0 = arr[(i - 1 + n) % n];
  const a1 = arr[i % n];
  const a2 = arr[(i + 1) % n];
  const a3 = arr[(i + 2) % n];
  return (
    0.5 *
    (2 * a1 +
      (-a0 + a2) * f +
      (2 * a0 - 5 * a1 + 4 * a2 - a3) * f * f +
      (-a0 + 3 * a1 - 3 * a2 + a3) * f * f * f)
  );
}

// Conveyor timing (matches design-shots-reveal so DOM/WebGL feel identical).
const SLOT_TIME = 5; // seconds for a tile to advance one slot
const EDGE_FADE = 0.35; // slots over which a tile fades out/in across the return

/**
 * Steady-state conveyor. Once the intro hands off (`running`), it loops a phase
 * p∈[0,1) at constant speed; each PAINT it writes every tile's base pose
 * (x/y/scale/opacity) from the arc path — the WebGL twin of design-shots-reveal's
 * rotation. The tiles were left exactly on their slots by the intro fly-in (p=0
 * passes through the slot points), so the handoff has no jump.
 *
 * HOST MAPPING (Phase 2): the private heavyEffectFpsCap throttle + invalidate()
 * are gone — the host pump paces the paint (this view is registered continuous
 * "heavy" while the conveyor runs and the hero is on screen). The tween is now a
 * pure pose CLOCK (it only advances `p`); the pose RECOMPUTE moved into a
 * useFrame, which under frameloop="never" runs only when the plane actually
 * paints — so poses recompute at exactly the capped cadence, never faster.
 * Off-screen the hero-gone gate PAUSES the tween (freezes p, so re-entry can't
 * jump) and the host idles the view to zero (no paints → no recompute); the view
 * flips continuous→demand in the parent, and a burst on return repaints.
 */
function ConveyorRig({
  tiles,
  arc,
  running,
  heroGone,
  tileEntry,
}: {
  tiles: TileLayout[];
  arc: ConveyorArc;
  running: boolean;
  /** Hero fully scrolled above the viewport — pause the pose clock. */
  heroGone: boolean;
  tileEntry: React.RefObject<TileEntry[]>;
}) {
  // The pose clock the tween advances and the useFrame reads (shared via a ref so
  // the pause/resume effect can touch the tween without recreating it).
  const clock = useRef({ p: 0 });
  const twRef = useRef<gsap.core.Tween | null>(null);

  // Create the looping pose clock once the conveyor starts. No onUpdate: the
  // tween just advances `p`; the useFrame below turns `p` into poses at paint
  // cadence.
  useEffect(() => {
    if (!running) return;
    const N = arc.xs.length; // 8 slots: 7 visible (0..6) + the return (7)
    const REVOLUTION = SLOT_TIME * N;
    const c = clock.current;
    c.p = 0;
    const tw = gsap.to(c, { p: 1, duration: REVOLUTION, ease: "none", repeat: -1 });
    twRef.current = tw;
    return () => {
      tw.kill();
      twRef.current = null;
    };
  }, [running, arc]);

  // Off-screen pause: the tiles live in the hero collage, so once the hero has
  // fully scrolled above the viewport the conveyor is invisible. Pause the clock
  // (0 work; freezes p so the wrap doesn't jump on return) WITHOUT recreating the
  // tween. The parent flips the view continuous→demand in the same beat, so the
  // host stops painting too.
  useEffect(() => {
    const tw = twRef.current;
    if (!tw) return;
    if (heroGone) tw.pause();
    else tw.resume();
  }, [heroGone, running]);

  // Recompute poses from the clock — runs ONLY on an actual paint (frameloop
  // "never" → useFrame fires per advance), so this is the capped-cadence pose
  // write the old throttled onUpdate used to do.
  useFrame(() => {
    if (!running) return;
    const entries = tileEntry.current;
    if (!entries) return;
    const N = arc.xs.length;
    const FRONT = N - 2; // last visible slot (far-R = 6); 7 is the hidden return
    const p = clock.current.p;
    tiles.forEach((t, i) => {
      const e = entries[i];
      if (!e) return;
      const s = ((p + t.arc / N) % 1) * N; // this tile's phase in [0, N)
      e.x = crClosed(arc.xs, s);
      e.y = crClosed(arc.ys, s);
      e.scale = crClosed(arc.sizes, s);
      // Solid across the whole front arc; fade out/in only on the off-screen
      // return leg so the wrap is seamless (no ghost, no empty slot).
      if (s <= FRONT) {
        e.opacity = 1;
      } else {
        const u = s - FRONT;
        const span = N - FRONT;
        e.opacity =
          u < EDGE_FADE
            ? 1 - u / EDGE_FADE
            : u > span - EDGE_FADE
              ? (u - (span - EDGE_FADE)) / EDGE_FADE
              : 0;
      }
    });
  });

  return null;
}

/**
 * Scroll anchoring (same approach as the clouds' ScrollAnchorRig): a fixed canvas
 * doesn't scroll, so we translate the tiles up in world space 1:1 with the page,
 * making the arc behave like the normal in-page DOM collage it replaces. The
 * conversion is the scene's px→world factor (8.284 / viewport height at z=0).
 * Scroll is locked during the intro, so this contributes nothing until handoff.
 */
function ScrollRig({
  fieldRef,
  heroGone,
  markDirty,
}: {
  fieldRef: React.RefObject<Group | null>;
  /** Hero fully scrolled above the viewport — keep writing position, gate paint. */
  heroGone: boolean;
  markDirty: () => void;
}) {
  const height = useThree((s) => s.size.height);

  // Read heroGone through a ref so the scrub effect (below) never re-runs — and
  // so kills/re-creates the ScrollTriggers — just because the gate toggled.
  const heroGoneRef = useRef(heroGone);
  useEffect(() => {
    heroGoneRef.current = heroGone;
  }, [heroGone]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const worldPerPx = 8.284 / height;
    // Off-screen paint gate: the tile field lives in the hero collage, so once
    // the hero has fully scrolled above the viewport nothing here is visible —
    // keep WRITING the scroll position (so re-entry is already correct) but skip
    // the markDirty so the demand view idles to zero. (While the hero is on
    // screen the view is continuous, so markDirty is a cheap no-op-along; the
    // gate is what makes the scrolled-away hero cost nothing.)
    const apply = (scroll: number) => {
      const g = fieldRef.current;
      if (!g) return;
      g.position.y = scroll * worldPerPx;
      if (!heroGoneRef.current) markDirty();
    };
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      scrub: true,
      onUpdate: (self) => apply(self.scroll()),
    });
    apply(window.scrollY || 0); // seed a mid-page restore

    // Re-seed after every refresh. ScrollTrigger.refresh() (fired on ANY resize)
    // reverts the scroller to 0 to take measurements, which makes the scrub
    // onUpdate above run with scroll=0 for a frame or two — snapping the whole
    // tile field back to position.y=0, i.e. its measured TOP-OF-PAGE origin. On a
    // demand view that repaints as a flash of the necklace at the top of whatever
    // section is on screen, and it sticks until the next scroll (the internal
    // scroll-restore doesn't re-fire onUpdate). Re-applying the true scroll once
    // refresh has restored the scroller overwrites that stale frame immediately.
    // Use st.scroll(), not window.scrollY — under Lenis the native value can
    // still read 0 for a tick right after the refresh.
    const onRefresh = () => apply(st.scroll());
    ScrollTrigger.addEventListener("refresh", onRefresh);
    return () => {
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      st.kill();
    };
  }, [height, markDirty, fieldRef]);

  // Repaint once on hero re-entry so any frame the off-screen skip left stale is
  // refreshed (mirrors the old onLeaveBack invalidate()).
  useEffect(() => {
    if (!heroGone) markDirty();
  }, [heroGone, markDirty]);

  return null;
}

/**
 * Signals the scene is ready to be revealed. Lives inside <Suspense>, so it
 * only mounts once every sibling's async resource (rock textures, Text3D font,
 * Environment HDR) has resolved. It then (a) precompiles every material in the
 * scene via gl.compileAsync — the MTM + Text3D shader burst otherwise lands
 * in-band on the first revealed frame and stalls the entrance — and (b) waits a
 * couple of painted frames, before firing onReady, so <Intro> starts the
 * entrance from the top instead of mid-animation (which looked like a pop after
 * the brief sky-only flash). compileAsync uses KHR_parallel_shader_compile
 * where available, so the compile overlaps the loader cover instead of blocking
 * the reveal. A 1.5s local failsafe stops a stalled driver compile from holding
 * the welcome hostage (intro.tsx's INTRO_LAST_RESORT_MS remains the outer net —
 * but that one BAILS to the DOM hero rather than forcing an unready play).
 */
function SceneReady({ onReady }: { onReady?: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const compiled = useRef(false);
  const done = useRef(false);
  const frames = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const finish = () => {
      if (!cancelled) compiled.current = true;
    };
    const failsafe = window.setTimeout(finish, 1500);
    gl.compileAsync(scene, camera).then(finish, finish);
    return () => {
      cancelled = true;
      window.clearTimeout(failsafe);
    };
  }, [gl, scene, camera]);

  useFrame(() => {
    if (done.current || !compiled.current) return;
    frames.current += 1;
    if (frames.current >= 2) {
      done.current = true;
      onReady?.();
    }
  });
  return null;
}

function Glass({
  anim,
  glassSize,
  glassGeomScale,
  restY,
  font = FONT,
  markDirty,
}: {
  anim: React.RefObject<GlassAnim>;
  glassSize: number;
  /** Proportional scale (≤1) for the absolute-world glass geometry (see props). */
  glassGeomScale: number;
  /** World y the glass rests at after the reveal — the slide-up target. */
  restY: number;
  font?: string;
  /** Flag the shared view dirty so the host paints the sky-crossfade step. */
  markDirty: () => void;
}) {
  // Scale every ABSOLUTE-world glass length by the geometry factor so a small
  // glyph's bevel/thickness/attenuation stay in the same ratio to the stroke as
  // on desktop (k=1 there → these are the exact tuned values). letterSpacing,
  // roughness, ior, transmission, aberration etc. are unitless/em and DON'T scale.
  const k = glassGeomScale;
  const ref = useRef<Group>(null);
  const textRef = useRef<Mesh>(null);
  // Refraction fill where the scene is empty (open sky) — without it the
  // transmission samples the transparent FBO (black) and the glass goes dark.
  // A GRADIENT texture of the current mode's real sky stops (lib/theme/
  // sky-backdrop) — a flat mid colour read wrong
  // against the graded DOM sky, especially two-tone sunrise/sunset. On a mode
  // switch the stops tween in lockstep with the site-wide sky CROSSFADE, each
  // step redrawing the tiny gradient + markDirty()-ing the shared view (during
  // the welcome the view is continuous, so the crossfade paints along regardless;
  // the markDirty makes it correct on its own for any demand moment).
  const mode = useMode();
  const [sky] = useState(() => makeSkyBackdrop(mode));
  useEffect(() => {
    return () => sky.texture.dispose();
  }, [sky]);

  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false;
      return;
    }
    const target = PALETTES[mode];
    const to = {
      top: new THREE.Color(target.sky.top),
      mid: new THREE.Color(target.sky.mid),
      bottom: new THREE.Color(target.sky.bottom),
    };
    const from = {
      top: sky.stops.top.clone(),
      mid: sky.stops.mid.clone(),
      bottom: sky.stops.bottom.clone(),
    };
    const proxy = { p: 0 };
    const tween = gsap.to(proxy, {
      p: 1,
      duration: CROSSFADE.duration,
      ease: CROSSFADE.ease,
      onUpdate: () => {
        sky.stops.top.copy(from.top).lerp(to.top, proxy.p);
        sky.stops.mid.copy(from.mid).lerp(to.mid, proxy.p);
        sky.stops.bottom.copy(from.bottom).lerp(to.bottom, proxy.p);
        sky.redraw();
        markDirty();
      },
    });
    return () => {
      tween.kill();
    };
  }, [mode, sky, markDirty]);

  // Adaptive glass quality (docs/performance-audit.md §6): the MTM is the intro's
  // heaviest frame cost (~3 scene renders/frame with backside on). Snapshot the
  // tier ONCE at mount — NOT reactively — so a watchdog step-down can't rebuild
  // the FBO mid-intro and flash the glass. The intro is short enough that the
  // starting tier is what matters here; the watchdog's warmup outlasts it anyway.
  const q = useMemo(() => getQualityConfig(), []);

  // Measure half the glyph height so the off-screen start sits FULLY below the
  // viewport edge (centre one half-height past the bottom). The glass slides up
  // from there to its rest — a true bottom-of-screen entrance, fully visible the
  // whole way (no mask), unlike the old clip-plane unmask-in-place reveal.
  const halfH = useRef(0);

  useLayoutEffect(() => {
    const mesh = textRef.current;
    if (!mesh) return;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return;
    halfH.current = (bb.max.y - bb.min.y) / 2;
  }, [glassSize, font]);

  useFrame(() => {
    const g = ref.current;
    const a = anim.current;
    if (!g || !a) return;
    // reveal 0→1 slides the glass UP from just below the viewport bottom to its
    // rest. At reveal=0 the centre sits a half-height past the bottom edge (fully
    // off-screen); at reveal=1 the offset is 0 (at rest). Dock keeps reveal=1, so
    // the offset stays 0 and never fights the dock travel.
    const startY = -VIEW_WORLD_H / 2 - halfH.current; // fully below the screen
    const revealOffset = (a.reveal - 1) * (restY - startY);
    g.position.set(a.x, a.y + revealOffset, 0);
    g.scale.setScalar(a.scale);
    g.rotation.set(a.rotX, a.rotY, 0);
    // Fade the glass out at the dock handoff (the canvas now persists for the
    // tiles, so we can't fade the whole wrapper — fade just the glass material).
    const mesh = textRef.current;
    if (mesh) {
      const mat = mesh.material as THREE.Material;
      mat.transparent = true;
      mat.opacity = a.opacity;
    }
  });

  return (
    <group ref={ref}>
      <Center>
        {/* Flat glass TEXT, not a 3D object: a very thin slab + soft bevel for
            the refractive edge. Side faces are killed mainly by the telephoto
            camera (the per-view PerspectiveCamera), which views the glyphs almost head-on. The
            glassiness comes from the transmission/bevel, not from depth. */}
        <Text3D
          ref={textRef}
          font={font}
          size={glassSize}
          height={0}
          curveSegments={q.text3dCurveSegments}
          bevelEnabled
          bevelThickness={0.175 * k}
          bevelSize={0.095 * k}
          bevelOffset={0}
          bevelSegments={q.text3dBevelSegments}
          letterSpacing={0.02}
        >
          ascnd
          <MeshTransmissionMaterial
            background={sky.texture}
            transmission={1}
            thickness={0.3 * k}
            roughness={0.31}
            ior={1.28}
            chromaticAberration={0.65}
            anisotropicBlur={0.28}
            distortion={0.2}
            distortionScale={0.4 * k}
            temporalDistortion={0.28}
            samples={q.mtmSamples}
            resolution={q.mtmResolution}
            backside={q.mtmBackside}
            backsideThickness={0.4 * k}
            clearcoat={0}
            clearcoatRoughness={0}
            attenuationDistance={4 * k}
            attenuationColor="#eaf4ff"
            color="#ffffff"
          />
        </Text3D>
      </Center>
    </group>
  );
}

export default function IntroScene({
  track,
  anim,
  rocks,
  rockEntry,
  tiles,
  tileEntry,
  arc,
  introActive,
  conveyor,
  glassSize,
  glassGeomScale,
  restY,
  font = FONT,
  onReady,
}: IntroSceneProps) {
  // The tile field group. <ScrollRig> translates its y by page scroll (the same
  // group-translation pattern as the clouds), so the arc tracks the page 1:1.
  const fieldRef = useRef<Group>(null);

  // Stable paint-control wrappers. useSharedView RETURNS the controls, but the
  // scene `children` are an ARGUMENT to that same call, so they can't close over
  // the returned object. Route through a ref pointed at the (stable) controls
  // right after the hook returns — child effects run after this render commits,
  // so they always see a populated ref.
  const controlsRef = useRef<SharedViewControls | null>(null);
  const markDirty = useCallback(() => controlsRef.current?.markDirty(), []);
  const requestBurst = useCallback(
    (n: number) => controlsRef.current?.requestBurst(n),
    [],
  );

  // Stable onReady wrapper so a fresh onReady identity from <Intro> never churns
  // the memoised children (a re-upsert) — SceneReady reads the latest.
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  const stableOnReady = useCallback(() => onReadyRef.current?.(), []);

  // Hero-visibility gate (KNOWN TRAP #1). The View placeholder is fixed inset-0
  // → it ALWAYS intersects the viewport, so the host's IntersectionObserver alone
  // can never idle a continuous view. The intro's real idle signal is the hero
  // scrolling away: gate paints feature-side off "[data-hero] bottom top" (the
  // same threshold the conveyor/scroll rigs use). When the hero is gone we flip
  // the registration continuous→demand (see `active` below) so the pump idles to
  // zero; on return we resume + burst a repaint.
  const [heroGone, setHeroGone] = useState(false);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const heroEl = document.querySelector<HTMLElement>("[data-hero]");
    if (!heroEl) return;
    const st = ScrollTrigger.create({
      trigger: heroEl,
      start: "bottom top", // hero's bottom passes the viewport top → fully gone
      end: "max",
      onEnter: () => setHeroGone(true),
      onLeaveBack: () => {
        setHeroGone(false);
        requestBurst(2);
      },
    });
    return () => st.kill();
  }, [requestBurst]);

  // dpr welcome window (KNOWN TRAP #3): the intro ran dpr 1 while the MTM glass
  // was on screen (its main-pass fragments were the boulder; the moving
  // refractive glass hides the softness), then [1,1.5] for the crisp steady
  // conveyor. On the shared context dpr is a plane-level ceiling — drive it
  // through the host's per-plane override exactly where the standalone canvas
  // flipped its own dpr. Released (null) at handoff and on unmount.
  useEffect(() => {
    setPlaneDprOverride("front", introActive ? INTRO_DPR : null);
  }, [introActive]);
  useEffect(() => () => setPlaneDprOverride("front", null), []);

  // Paint policy (KNOWN TRAP #4). Continuous "heavy" while the welcome or the
  // conveyor is actively animating AND the hero is on screen — the host pump
  // paces it (60 on a fast panel, display-rate ≤60Hz), and scroll repaints ride
  // along for free. Demand "scroll" otherwise, so a scrolled-away hero idles to
  // zero and a scroll re-entry rides the display. Registration is upsert-able,
  // so flipping these on a React state change just updates the descriptor — no
  // remount, no lost burst.
  const active = (introActive || conveyor) && !heroGone;
  const mode = active ? "continuous" : "demand";
  const fpsCap = active ? "heavy" : "scroll";

  const children: ReactNode = useMemo(
    () => (
      <>
        {/* Per-view telephoto camera (KNOWN TRAP #2). The host canvas has a
            neutral default camera; drei's <View> renders each portal with its
            portal-scoped default camera, and <PerspectiveCamera makeDefault>
            inside the view children swaps THAT one (not the root's) — verified in
            node_modules/@react-three/drei/core/PerspectiveCamera.js (set() runs on
            the portal store) + web/View.js (Container renders with state.camera).
            fov 11.82° at z=40 keeps the z=0 plane height at 8.284 — the exact
            mapping intro.tsx assumes (wpp = 8.284/innerHeight); it holds ONLY
            because the placeholder is full-viewport (fixed inset-0). <View>
            overwrites camera.aspect to the (full-viewport) track rect each frame,
            so vertical framing stays fixed. */}
        <PerspectiveCamera
          makeDefault
          position={[0, 0, CAMERA_Z]}
          fov={11.82}
          near={0.1}
          far={100}
        />

        {/* Ready-gate boundary: ONLY what the entrance needs on frame 0 — the
            rock textures, the Text3D font, the (network-free) env. SceneReady
            lives here so onReady fires the instant THOSE resolve. The shot tiles
            are NOT in here: they're 7 extra textures that aren't visible until the
            dock ~2s in, and bundling them onto this gate delayed the whole
            welcome. KNOWN TRAP #6: the host wraps this whole view in ONE Suspense;
            these TWO nested boundaries are preserved so tile textures never block
            the ready gate. */}
        <Suspense fallback={null}>
          {/* Glass + rocks are intro-phase guests: mounted only while welcoming,
              then unmounted so the steady scene is just the tile planes. */}
          {introActive && (
            <>
              <Rocks rocks={rocks} rockEntry={rockEntry} />
              <Glass
                anim={anim}
                glassSize={glassSize}
                glassGeomScale={glassGeomScale}
                restY={restY}
                font={font}
                markDirty={markDirty}
              />
              <directionalLight position={[3, 5, 6]} intensity={1.2} />
              <ambientLight intensity={0.4} />
              <SceneReady onReady={stableOnReady} />
            </>
          )}
        </Suspense>

        {/* Tiles stream in on their OWN boundary so their shot textures never hold
            up the ready gate above. They live here for the whole session (intro
            fly-in → steady conveyor). ConveyorRig is placed BEFORE Tiles so its
            per-paint pose write (useFrame) lands before Tiles reads tileEntry —
            no 1-frame lag (the old rig wrote poses on the gsap ticker, ahead of
            the render). */}
        <Suspense fallback={null}>
          <ConveyorRig
            tiles={tiles}
            arc={arc}
            running={conveyor}
            heroGone={heroGone}
            tileEntry={tileEntry}
          />
          <Tiles tiles={tiles} tileEntry={tileEntry} fieldRef={fieldRef} />
          <ScrollRig
            fieldRef={fieldRef}
            heroGone={heroGone}
            markDirty={markDirty}
          />
        </Suspense>

        {/* Local studio shine (see GlassEnvironment) — no network, so the glints
            are present on frame 1 instead of popping in late. Glass-only, so it
            rides the intro phase and unmounts with the glass. */}
        {introActive && (
          <GlassEnvironment
            environmentIntensity={1.85}
            frontFill={0.5}
            leftFill={2.15}
            rightFill={2.6}
            bottomFill={3.6}
            keyGlint={5.2}
            topRim={1.1}
          />
        )}
      </>
    ),
    [
      introActive,
      conveyor,
      heroGone,
      rocks,
      rockEntry,
      tiles,
      tileEntry,
      arc,
      glassSize,
      glassGeomScale,
      restY,
      font,
      anim,
      markDirty,
      stableOnReady,
    ],
  );

  const controls = useSharedView({
    plane: "front",
    index: FRONT_INDEX.INTRO_TILES,
    track,
    // NoToneMapping (KNOWN TRAP #5): the glass must clip, not roll off. The host
    // sets it for this view at priority index-1 (replaces the old onCreated).
    toneMapping: THREE.NoToneMapping,
    mode,
    fpsCap,
    children,
  });
  // Point the wrapper ref at the (stable) controls. A LAYOUT effect, so it lands
  // in the commit's layout phase — BEFORE any child's passive mount effect (e.g.
  // ScrollRig's seed markDirty), so those wrappers are never a null no-op. No
  // child LAYOUT effect touches the controls, so this ordering is sufficient.
  useLayoutEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  return null;
}

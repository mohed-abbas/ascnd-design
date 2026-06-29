"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Center,
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  Text3D,
  useTexture,
} from "@react-three/drei";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Group, Mesh } from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Warm the local assets ASAP so the scene's ready-gate isn't waiting on a
// cold fetch (the rock cut-outs; the Environment HDR loads in its own Suspense
// so it never blocks the reveal — see the canvas below).
useTexture.preload("/rocks/left-rock.webp");
useTexture.preload("/rocks/right-rock.webp");
// The introV2 "shot" tiles (the necklace beads-to-be) refract through the glass,
// so they live in the scene too — warm them alongside the rocks.
for (const n of [2, 3, 4, 5, 6, 7, 8]) useTexture.preload(`/shots/shot${n}.png`);

/**
 * The welcome-intro WebGL stage. Reuses the proven /lab/glass setup — PERSPECTIVE
 * camera (z=10, fov=45, the cloud-canvas convention) at a small world scale, so
 * the liquid glass refracts/disperses richly (a flat-on orthographic view of huge
 * letters just shows the backdrop straight through and looks solid).
 *
 * <Intro> measures the DOM in pixels and converts to world units (1px ≈
 * 8.284/innerHeight world units at z=0), so positions/sizes still line up with
 * the hero. The canvas is TRANSPARENT — the DOM sky + clouds show through; only
 * the two rock planes (refraction source under 'a'/'d', pixel-matched over the
 * DOM rocks) and the glass live in the scene. The material's `background` sky
 * colour fills the transmission where the scene is empty (open sky).
 *
 * Transforms are driven imperatively from <Intro>'s GSAP timeline via the shared
 * `anim` ref; frameloop is "always" for the brief intro.
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
  /** Intro phase: glass + rocks mounted, frameloop "always". Off → steady state. */
  introActive: boolean;
  /** Run the steady-state conveyor (starts when the intro fly-in lands). */
  conveyor: boolean;
  /** Text3D `size` in WORLD units (≈ 4–5, matching the lab). */
  glassSize: number;
  /** World y the glass rests at (the welcome spot) — anchors the reveal clip. */
  restY: number;
  font?: string;
  /** Fired once the scene's local assets have loaded and a frame painted. */
  onReady?: () => void;
};

const FONT = "/fonts/product-sans-medium.typeface.json";

// Camera + rock depth, exported so <Intro> can compensate its DOM→world rock
// placement: the planes sit slightly BEHIND the glass (so it refracts them), and
// a point at ROCK_Z projects a touch toward screen centre vs the z=0 mapping
// <Intro> measures with. <Intro> scales the rock coords by (CAMERA_Z - ROCK_Z) /
// CAMERA_Z so they project to exactly the measured DOM rect — flush to the edges.
export const CAMERA_Z = 40;
export const ROCK_Z = -0.3;
// Tiles sit just behind the glass (so it refracts them) and a hair in FRONT of
// the rocks. <Intro> compensates its DOM→world tile placement by TILE_DEPTH, the
// same projection trick the rocks use, so a tile lands pixel-exact on the DOM
// shot it crossfades to.
export const TILE_Z = -0.2;

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
 * Exported so /lab/glass renders the EXACT same shine — the lab stays a faithful
 * preview, and passes Leva-driven intensities here for live tuning. The defaults
 * ARE the production values, so the intro calls `<GlassEnvironment />` bare.
 * `frames` defaults to 1, so the cubemap is rendered once (cheap); the lab passes
 * `Infinity` so slider changes re-bake live.
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
  const S = 256;
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
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);

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
  // ONCE to the whole field group (see <ScrollRig>), so it's not added here.
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
    });
  });

  return (
    <group ref={fieldRef}>
      {tiles.map((t, i) => (
        <mesh
          key={i}
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
 * p∈[0,1) at constant speed and writes each tile's base pose (x/y/scale/opacity)
 * from the arc path — the WebGL twin of design-shots-reveal's rotation. The tiles
 * were left exactly on their slots by the intro fly-in (p=0 passes through the
 * slot points), so the handoff has no jump. demand-mode: invalidate() each tick.
 */
function ConveyorRig({
  tiles,
  arc,
  running,
  tileEntry,
}: {
  tiles: TileLayout[];
  arc: ConveyorArc;
  running: boolean;
  tileEntry: React.RefObject<TileEntry[]>;
}) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!running) return;
    const N = arc.xs.length; // 8 slots: 7 visible (0..6) + the return (7)
    const FRONT = N - 2; // last visible slot (far-R = 6); 7 is the hidden return
    const REVOLUTION = SLOT_TIME * N;
    const state = { p: 0 };

    const render = () => {
      const entries = tileEntry.current;
      if (!entries) return;
      tiles.forEach((t, i) => {
        const e = entries[i];
        if (!e) return;
        const s = ((state.p + t.arc / N) % 1) * N; // this tile's phase in [0, N)
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
      invalidate();
    };

    const tw = gsap.to(state, {
      p: 1,
      duration: REVOLUTION,
      ease: "none",
      repeat: -1,
      onUpdate: render,
    });
    return () => {
      tw.kill();
    };
  }, [running, tiles, arc, tileEntry, invalidate]);

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
}: {
  fieldRef: React.RefObject<Group | null>;
}) {
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const worldPerPx = 8.284 / height;
    const apply = (scroll: number) => {
      const g = fieldRef.current;
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
    apply(window.scrollY || 0); // seed a mid-page restore
    return () => st.kill();
  }, [height, invalidate, fieldRef]);

  return null;
}

/**
 * Signals the scene is ready to be revealed. Lives inside <Suspense>, so it
 * only mounts once every sibling's async resource (rock textures, Text3D font,
 * Environment HDR) has resolved; it then waits a couple of painted frames
 * before firing onReady, so <Intro> can start the entrance from the top instead
 * of mid-animation (which looked like a pop after the brief sky-only flash).
 */
function SceneReady({ onReady }: { onReady?: () => void }) {
  const done = useRef(false);
  const frames = useRef(0);
  useFrame(() => {
    if (done.current) return;
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
  restY,
  font = FONT,
}: {
  anim: React.RefObject<GlassAnim>;
  glassSize: number;
  /** World y the glass rests at after the reveal — the slide-up target. */
  restY: number;
  font?: string;
}) {
  const ref = useRef<Group>(null);
  const textRef = useRef<Mesh>(null);
  // Refraction fill where the scene is empty (open sky) — without it the
  // transmission samples the transparent FBO (black) and the glass goes dark.
  const sky = useMemo(() => new THREE.Color("#62abff"), []);

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
            camera (see <Canvas>), which views the glyphs almost head-on. The
            glassiness comes from the transmission/bevel, not from depth. */}
        <Text3D
          ref={textRef}
          font={font}
          size={glassSize}
          height={0}
          curveSegments={32}
          bevelEnabled
          bevelThickness={0.175}
          bevelSize={0.095}
          bevelOffset={0}
          bevelSegments={12}
          letterSpacing={0.02}
        >
          ascnd
          <MeshTransmissionMaterial
            background={sky}
            transmission={1}
            thickness={0.3}
            roughness={0.31}
            ior={1.28}
            chromaticAberration={0.65}
            anisotropicBlur={0.28}
            distortion={0.2}
            distortionScale={0.4}
            temporalDistortion={0.28}
            samples={10}
            resolution={1024}
            backside={true}
            backsideThickness={0.4}
            clearcoat={0}
            clearcoatRoughness={0}
            attenuationDistance={4}
            attenuationColor="#eaf4ff"
            color="#ffffff"
          />
        </Text3D>
      </Center>
    </group>
  );
}

export default function IntroScene({
  anim,
  rocks,
  rockEntry,
  tiles,
  tileEntry,
  arc,
  introActive,
  conveyor,
  glassSize,
  restY,
  font = FONT,
  onReady,
}: IntroSceneProps) {
  // The tile field group. <ScrollRig> translates its y by page scroll (the same
  // group-translation pattern as the clouds), so the arc tracks the page 1:1.
  const fieldRef = useRef<Group>(null);

  return (
    <Canvas
      // "always" while the glass is on screen (transmission + animation need a
      // live loop); "demand" once it's gone — the steady tile conveyor/scroll
      // pump invalidate() themselves, so the persistent canvas stays cheap.
      frameloop={introActive ? "always" : "demand"}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      // Telephoto: far back + narrow FOV → the glyphs are viewed almost head-on
      // so the thin extrusion shows no side faces (flat glass text, not a 3D
      // block). fov 11.82° at z=40 keeps the visible height at the z=0 plane at
      // 8.284 units — the SAME mapping <Intro> assumes (wpp = 8.284/innerHeight),
      // so positions/sizes are unchanged.
      camera={{ position: [0, 0, CAMERA_Z], fov: 11.82, near: 0.1, far: 100 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      {/* Ready-gate boundary: ONLY what the entrance needs on frame 0 — the rock
          textures, the Text3D font, the (network-free) env. SceneReady lives here
          so onReady fires the instant THOSE resolve. The shot tiles are NOT in
          here: they're 7 extra textures that aren't visible until the dock ~2s in,
          and bundling them onto this gate delayed the whole welcome. */}
      <Suspense fallback={null}>
        {/* Glass + rocks are intro-phase guests: mounted only while welcoming,
            then unmounted so the steady scene is just the tile planes. They need
            only LOCAL assets (preloaded), so SceneReady fires fast. */}
        {introActive && (
          <>
            <Rocks rocks={rocks} rockEntry={rockEntry} />
            <Glass anim={anim} glassSize={glassSize} restY={restY} font={font} />
            <directionalLight position={[3, 5, 6]} intensity={1.2} />
            <ambientLight intensity={0.4} />
            <SceneReady onReady={onReady} />
          </>
        )}
      </Suspense>

      {/* Tiles stream in on their OWN boundary so their shot textures never hold
          up the ready gate above. They live here for the whole session (intro
          fly-in → steady conveyor); the conveyor + scroll rig ride with them
          (ScrollRig translates the tile field, so it belongs here). They bloom in
          ~0.1s into the timeline and aren't prominent at the reveal, so a few
          frames of late arrival is invisible — but it no longer blocks the start. */}
      <Suspense fallback={null}>
        <Tiles tiles={tiles} tileEntry={tileEntry} fieldRef={fieldRef} />
        <ConveyorRig
          tiles={tiles}
          arc={arc}
          running={conveyor}
          tileEntry={tileEntry}
        />
        <ScrollRig fieldRef={fieldRef} />
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
    </Canvas>
  );
}

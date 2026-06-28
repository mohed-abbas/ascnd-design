"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  Center,
  Environment,
  MeshTransmissionMaterial,
  Text3D,
  useTexture,
} from "@react-three/drei";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Group, Mesh } from "three";

// Warm the local assets ASAP so the scene's ready-gate isn't waiting on a
// cold fetch (the rock cut-outs; the Environment HDR loads in its own Suspense
// so it never blocks the reveal — see the canvas below).
useTexture.preload("/rocks/left-rock.png");
useTexture.preload("/rocks/right-rock.png");

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
};

export type RockLayout = {
  src: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
};

/** Per-rock entrance state, driven by <Intro>'s timeline (the WebGL "drift"). */
export type RockEntry = {
  opacity: number;
  /** World-unit y offset added to the rock's resting position (settle). */
  yOffset: number;
};

export type IntroSceneProps = {
  anim: React.RefObject<GlassAnim>;
  rocks: RockLayout[];
  /** Per-rock entrance (opacity + settle), index-matched to `rocks`. */
  rockEntry: React.RefObject<RockEntry[]>;
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

// The glass reveal clip plane (world space): keeps only y ≥ baseline. Module
// scope so it's a stable, freely-mutable instance — there's only ever one Glass
// on screen. Its `constant` is set to the glyph baseline once the geometry is
// measured (see <Glass>); the glass rises through it to unmask in place.
const GLASS_CLIP = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

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
      if (mesh) mesh.position.y = r.cy + e.yOffset;
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
  /** World y the glass rests at after the reveal — anchors the clip baseline. */
  restY: number;
  font?: string;
}) {
  const ref = useRef<Group>(null);
  const textRef = useRef<Mesh>(null);
  // Refraction fill where the scene is empty (open sky) — without it the
  // transmission samples the transparent FBO (black) and the glass goes dark.
  const sky = useMemo(() => new THREE.Color("#62abff"), []);

  // Measure the built glyph and anchor the world-space clip baseline (GLASS_CLIP)
  // at its resting bottom. The glass enters fully BELOW the plane (clipped,
  // invisible) and rises through it, so it's revealed bottom-up in place — the
  // WebGL twin of the hero text's overflow:hidden masked slide-up, rather than
  // flying up from the bottom of the screen. The plane is fixed in world, so the
  // later dock (which moves UP, away from it) is never clipped. Half the glyph
  // height drives both the baseline offset and the reveal travel.
  const halfH = useRef(0);

  useLayoutEffect(() => {
    const mesh = textRef.current;
    if (!mesh) return;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return;
    halfH.current = (bb.max.y - bb.min.y) / 2;
    GLASS_CLIP.constant = -(restY - halfH.current); // keep world y ≥ baseline
  }, [restY, glassSize, font]);

  useFrame(() => {
    const g = ref.current;
    const a = anim.current;
    if (!g || !a) return;
    // reveal 0→1 lifts the glass from one glyph-height below the baseline (fully
    // clipped) up to its rest; at reveal=1 the offset is 0. Dock keeps reveal=1.
    const revealOffset = (a.reveal - 1) * 2 * halfH.current;
    g.position.set(a.x, a.y + revealOffset, 0);
    g.scale.setScalar(a.scale);
    g.rotation.set(a.rotX, a.rotY, 0);
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
          height={glassSize * 0.018}
          curveSegments={16}
          bevelEnabled
          bevelThickness={glassSize * 0.006}
          bevelSize={glassSize * 0.008}
          bevelOffset={0}
          bevelSegments={5}
          letterSpacing={-glassSize * 0.03}
        >
          ascnd
          <MeshTransmissionMaterial
            background={sky}
            transmission={1}
            thickness={glassSize * 0.16}
            roughness={0.16}
            ior={1.45}
            chromaticAberration={0.6}
            anisotropicBlur={0.28}
            distortion={0.14}
            distortionScale={0.3}
            temporalDistortion={0.05}
            samples={8}
            resolution={1024}
            backside
            backsideThickness={glassSize * 0.02}
            clearcoat={1}
            clearcoatRoughness={0}
            color="#ffffff"
            clippingPlanes={[GLASS_CLIP]}
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
  glassSize,
  restY,
  font = FONT,
  onReady,
}: IntroSceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      // Telephoto: far back + narrow FOV → the glyphs are viewed almost head-on
      // so the thin extrusion shows no side faces (flat glass text, not a 3D
      // block). fov 11.82° at z=40 keeps the visible height at the z=0 plane at
      // 8.284 units — the SAME mapping <Intro> assumes (wpp = 8.284/innerHeight),
      // so positions/sizes are unchanged.
      camera={{ position: [0, 0, CAMERA_Z], fov: 11.82 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.localClippingEnabled = true; // for the glass reveal clip plane
      }}
    >
      {/* Rocks + glass gate the reveal: they only need LOCAL assets (preloaded
          above), so SceneReady fires fast and the sky-only flash is short. */}
      <Suspense fallback={null}>
        <Rocks rocks={rocks} rockEntry={rockEntry} />
        <Glass anim={anim} glassSize={glassSize} restY={restY} font={font} />
        <directionalLight position={[3, 5, 6]} intensity={1.2} />
        <ambientLight intensity={0.4} />
        <SceneReady onReady={onReady} />
      </Suspense>
      {/* The Environment HDR is a remote fetch; its OWN boundary so it never
          blocks the reveal — the glass picks up its reflections a beat later. */}
      <Suspense fallback={null}>
        <Environment preset="city" environmentIntensity={1.1} />
      </Suspense>
    </Canvas>
  );
}

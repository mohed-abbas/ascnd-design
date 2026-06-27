"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  Center,
  Environment,
  MeshTransmissionMaterial,
  Text3D,
  useTexture,
} from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Group } from "three";

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
};

export type RockLayout = {
  src: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
};

export type IntroSceneProps = {
  anim: React.RefObject<GlassAnim>;
  rocks: RockLayout[];
  /** Text3D `size` in WORLD units (≈ 4–5, matching the lab). */
  glassSize: number;
  font?: string;
};

const FONT = "/fonts/product-sans-medium.typeface.json";

// Camera + rock depth, exported so <Intro> can compensate its DOM→world rock
// placement: the planes sit slightly BEHIND the glass (so it refracts them), and
// a point at ROCK_Z projects a touch toward screen centre vs the z=0 mapping
// <Intro> measures with. <Intro> scales the rock coords by (CAMERA_Z - ROCK_Z) /
// CAMERA_Z so they project to exactly the measured DOM rect — flush to the edges.
export const CAMERA_Z = 40;
export const ROCK_Z = -0.3;

function Rocks({ rocks }: { rocks: RockLayout[] }) {
  const maps = useTexture(rocks.map((r) => r.src));
  return (
    <group>
      {rocks.map((r, i) => (
        <mesh key={i} position={[r.cx, r.cy, ROCK_Z]}>
          <planeGeometry args={[r.w, r.h]} />
          <meshBasicMaterial
            map={maps[i] as THREE.Texture}
            transparent
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Glass({
  anim,
  glassSize,
  font = FONT,
}: {
  anim: React.RefObject<GlassAnim>;
  glassSize: number;
  font?: string;
}) {
  const ref = useRef<Group>(null);
  // Refraction fill where the scene is empty (open sky) — without it the
  // transmission samples the transparent FBO (black) and the glass goes dark.
  const sky = useMemo(() => new THREE.Color("#62abff"), []);

  useFrame(() => {
    const g = ref.current;
    const a = anim.current;
    if (!g || !a) return;
    g.position.set(a.x, a.y, 0);
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
          />
        </Text3D>
      </Center>
    </group>
  );
}

export default function IntroScene({
  anim,
  rocks,
  glassSize,
  font = FONT,
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
      }}
    >
      <Suspense fallback={null}>
        <Rocks rocks={rocks} />
        <Glass anim={anim} glassSize={glassSize} font={font} />
        <Environment preset="city" environmentIntensity={1.1} />
        <directionalLight position={[3, 5, 6]} intensity={1.2} />
        <ambientLight intensity={0.4} />
      </Suspense>
    </Canvas>
  );
}

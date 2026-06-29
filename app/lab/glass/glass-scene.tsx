"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Center,
  MeshTransmissionMaterial,
  Text3D,
  useTexture,
} from "@react-three/drei";
import { GlassEnvironment } from "@/components/sections/intro/intro-scene";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import type { Group } from "three";
import { Leva, useControls, button } from "leva";

/**
 * PHASE-1 LAB ONLY — /lab/glass
 *
 * Isolated playground to tune the liquid-glass "ascnd" before it's wired into the
 * welcome intro. Extruded Product Sans (Text3D, our subset typeface.json) wearing
 * drei's <MeshTransmissionMaterial> (real refraction + dispersion), lit by an
 * <Environment> for the Apple-style specular sheen. The backdrop is throwaway
 * test imagery (rocks + colourful design-shot tiles) purely so the refraction has
 * something vivid to bend — Phase 2 replaces it with the real hero backdrop.
 */

const FONT = "/fonts/product-sans-medium.typeface.json";
const SHOTS = ["/shots/shot3.png", "/shots/shot4.png", "/shots/shot5.png", "/shots/shot6.png", "/shots/shot7.png"];

// Latest Leva values, kept module-side so the "copy config" button reads fresh
// data without touching a React ref during render (a lab-only convenience).
const labConfig: { geo?: unknown; mat?: unknown; env?: unknown } = {};

/**
 * The shared GlassEnvironment driven by a Leva "Environment" folder so the team
 * can dial the shine + outline lighting live. `frames={Infinity}` re-bakes the
 * cubemap every frame so slider changes show instantly (lab-only cost; the intro
 * keeps the default single bake). Values default to the production look.
 */
function TunableEnvironment() {
  const env = useControls("Environment", {
    environmentIntensity: { value: 3, min: 0, max: 4, step: 0.05 },
    frontFill: { value: 0.05, min: 0, max: 6, step: 0.05 },
    leftFill: { value: 1.7, min: 0, max: 6, step: 0.05 },
    rightFill: { value: 1.7, min: 0, max: 6, step: 0.05 },
    bottomFill: { value: 1.5, min: 0, max: 6, step: 0.05 },
    keyGlint: { value: 4, min: 0, max: 10, step: 0.1 },
    topRim: { value: 2.6, min: 0, max: 10, step: 0.1 },
  });
  useEffect(() => {
    labConfig.env = env;
  }, [env]);
  return <GlassEnvironment frames={Infinity} {...env} />;
}

/** Throwaway colourful backdrop the glass refracts. */
function TestBackdrop() {
  const shots = useTexture(SHOTS);
  const [leftRock, rightRock] = useTexture(["/rocks/left-rock.webp", "/rocks/right-rock.webp"]);
  return (
    <group position={[0, 0, -2.2]}>
      {/* colourful tiles spread behind the word */}
      {shots.map((tex, i) => {
        const x = -4.4 + i * 2.2;
        return (
          <mesh key={i} position={[x, (i % 2 === 0 ? 0.5 : -0.5), 0]}>
            <planeGeometry args={[2.0, 2.0]} />
            <meshBasicMaterial map={tex as THREE.Texture} toneMapped={false} />
          </mesh>
        );
      })}
      {/* rocks at the far edges, under the 'a' and 'd' */}
      <mesh position={[-5.4, -1.2, 0.2]}>
        <planeGeometry args={[2.9, 8]} />
        <meshBasicMaterial map={leftRock} transparent toneMapped={false} />
      </mesh>
      <mesh position={[5.4, -1.2, 0.2]}>
        <planeGeometry args={[2.8, 8]} />
        <meshBasicMaterial map={rightRock} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * The glass wordmark. Subtle pointer-driven tilt so the refraction reads as 3D.
 * Every Text3D geometry + MeshTransmissionMaterial prop is wired to a live Leva
 * panel (see the folders below) so the team can tune the glass interactively;
 * the "copy config" button dumps the current values as JSON to the clipboard so
 * a tuned look can be pasted straight back into intro-scene.tsx.
 */
function GlassWord() {
  const ref = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);

  // Re-invalidate on every Leva change so demand-style renderers repaint too
  // (this Canvas runs "always", but invalidate() is harmless and future-proofs
  // it). Each control maps 1:1 to a Text3D or material prop below.
  const geo = useControls("Geometry", {
    size: { value: 4, min: 1, max: 8, step: 0.05 },
    height: { value: 0.6, min: 0, max: 2, step: 0.01 },
    curveSegments: { value: 16, min: 2, max: 32, step: 1 },
    bevelThickness: { value: 0.08, min: 0, max: 0.5, step: 0.005 },
    bevelSize: { value: 0.045, min: 0, max: 0.3, step: 0.005 },
    bevelSegments: { value: 6, min: 1, max: 12, step: 1 },
    letterSpacing: { value: -0.12, min: -0.5, max: 0.2, step: 0.01 },
  });

  const mat = useControls("Material", {
    transmission: { value: 1, min: 0, max: 1, step: 0.01 },
    thickness: { value: 1.1, min: 0, max: 5, step: 0.01 },
    roughness: { value: 0.16, min: 0, max: 1, step: 0.01 },
    ior: { value: 1.45, min: 1, max: 2.333, step: 0.01 },
    chromaticAberration: { value: 0.65, min: 0, max: 3, step: 0.01 },
    anisotropicBlur: { value: 0.28, min: 0, max: 2, step: 0.01 },
    distortion: { value: 0.2, min: 0, max: 2, step: 0.01 },
    distortionScale: { value: 0.4, min: 0, max: 1, step: 0.01 },
    temporalDistortion: { value: 0.06, min: 0, max: 1, step: 0.01 },
    samples: { value: 8, min: 1, max: 24, step: 1 },
    resolution: { value: 1024, min: 256, max: 2048, step: 256 },
    backside: true,
    backsideThickness: { value: 0.4, min: 0, max: 2, step: 0.01 },
    clearcoat: { value: 1, min: 0, max: 1, step: 0.01 },
    clearcoatRoughness: { value: 0, min: 0, max: 1, step: 0.01 },
    attenuationDistance: { value: 4, min: 0.1, max: 10, step: 0.1 },
    attenuationColor: "#eaf4ff",
    color: "#ffffff",
  });

  // Mirror the latest values module-side so the copy button reads them fresh.
  useEffect(() => {
    labConfig.geo = geo;
    labConfig.mat = mat;
  }, [geo, mat]);
  useControls("Actions", {
    "copy config": button(() => {
      const cfg = JSON.stringify(labConfig, null, 2);
      navigator.clipboard?.writeText(cfg);
      console.log("[lab/glass] config copied:\n" + cfg);
    }),
  });

  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const tx = state.pointer.y * 0.12;
    const ty = state.pointer.x * 0.18;
    g.rotation.x += (tx - g.rotation.x) * 0.06;
    g.rotation.y += (ty - g.rotation.y) * 0.06;
    invalidate();
  });

  return (
    <group ref={ref}>
      <Center key={`${geo.size}-${geo.height}-${geo.curveSegments}-${geo.bevelSegments}`}>
        <Text3D
          font={FONT}
          size={geo.size}
          height={geo.height}
          curveSegments={geo.curveSegments}
          bevelEnabled
          bevelThickness={geo.bevelThickness}
          bevelSize={geo.bevelSize}
          bevelOffset={0}
          bevelSegments={geo.bevelSegments}
          letterSpacing={geo.letterSpacing}
        >
          ascnd
          <MeshTransmissionMaterial
            transmission={mat.transmission}
            thickness={mat.thickness}
            roughness={mat.roughness}
            ior={mat.ior}
            chromaticAberration={mat.chromaticAberration}
            anisotropicBlur={mat.anisotropicBlur}
            distortion={mat.distortion}
            distortionScale={mat.distortionScale}
            temporalDistortion={mat.temporalDistortion}
            samples={mat.samples}
            resolution={mat.resolution}
            backside={mat.backside}
            backsideThickness={mat.backsideThickness}
            clearcoat={mat.clearcoat}
            clearcoatRoughness={mat.clearcoatRoughness}
            attenuationDistance={mat.attenuationDistance}
            attenuationColor={mat.attenuationColor}
            color={mat.color}
          />
        </Text3D>
      </Center>
    </group>
  );
}

export default function GlassScene() {
  return (
    <>
      {/* Tuning panel — DOM overlay, lives outside the Canvas. */}
      <Leva collapsed={false} titleBar={{ title: "ascnd glass" }} />
      <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{ position: [0, 0, 10], fov: 45 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      <color attach="background" args={["#62abff"]} />
      <Suspense fallback={null}>
        <TestBackdrop />
        <GlassWord />
        {/* Sheen for the bevels — the SAME local studio glints the intro uses,
            now Leva-driven (Environment folder) for live tuning. */}
        <TunableEnvironment />
        <directionalLight position={[3, 5, 6]} intensity={1.2} />
        <ambientLight intensity={0.4} />
      </Suspense>
      </Canvas>
    </>
  );
}

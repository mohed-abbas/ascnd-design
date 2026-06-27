"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Center,
  Environment,
  MeshTransmissionMaterial,
  Text3D,
  useTexture,
} from "@react-three/drei";
import { Suspense, useRef } from "react";
import * as THREE from "three";
import type { Group } from "three";

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

/** Throwaway colourful backdrop the glass refracts. */
function TestBackdrop() {
  const shots = useTexture(SHOTS);
  const [leftRock, rightRock] = useTexture(["/rocks/left-rock.png", "/rocks/right-rock.png"]);
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

/** The glass wordmark. Subtle pointer-driven tilt so the refraction reads as 3D. */
function GlassWord() {
  const ref = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);

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
      <Center>
        <Text3D
          font={FONT}
          size={4}
          height={0.6}
          curveSegments={16}
          bevelEnabled
          bevelThickness={0.08}
          bevelSize={0.045}
          bevelOffset={0}
          bevelSegments={6}
          letterSpacing={-0.12}
        >
          ascnd
          <MeshTransmissionMaterial
            transmission={1}
            thickness={1.1}
            roughness={0.16}
            ior={1.45}
            chromaticAberration={0.65}
            anisotropicBlur={0.28}
            distortion={0.2}
            distortionScale={0.4}
            temporalDistortion={0.06}
            samples={8}
            resolution={1024}
            backside
            backsideThickness={0.4}
            clearcoat={1}
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

export default function GlassScene() {
  return (
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
        {/* Sheen for the bevels — the bright liquid-glass highlights. */}
        <Environment preset="city" environmentIntensity={1.1} />
        <directionalLight position={[3, 5, 6]} intensity={1.2} />
        <ambientLight intensity={0.4} />
      </Suspense>
    </Canvas>
  );
}

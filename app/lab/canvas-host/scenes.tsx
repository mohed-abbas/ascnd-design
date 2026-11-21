"use client";

import { Cloud, Clouds, MeshTransmissionMaterial } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { Mesh } from "three";

/**
 * Demo scenes for /lab/canvas-host — the SAME content the Phase-0 spike used
 * (rotating MTM glass under NoToneMapping · drei <Clouds> under ACES · identical
 * emissive reference spheres · a saturated red probe), but with NO <View> and NO
 * <ToneMapping> of their own: here they are the `children` passed to
 * useSharedView, and the PRODUCTION host (components/canvas/plane-canvas.tsx)
 * wraps each in a drei <View> and sets its tone mapping at priority index-1. So
 * this route exercises the real host end-to-end, not a bespoke canvas.
 */

// Reference sphere — identical params in both tone-mapping scenes; emissive pushed
// past 1 so it clips flat under NoToneMapping (glass) and rolls off under ACES
// (clouds). Fresh material per instance (never shared across views — the
// load-bearing tone-mapping rule).
function ReferenceSphere() {
  return (
    <mesh position={[1.9, 1.3, -0.3]}>
      <sphereGeometry args={[0.45, 32, 32]} />
      <meshStandardMaterial color="#000000" emissive="#ffffff" emissiveIntensity={3} toneMapped />
    </mesh>
  );
}

/** VIEW A — glass. Rotates every advance (continuous view), so the plane paints
 *  continuously while it's on screen. */
export function GlassScene() {
  const knot = useRef<Mesh>(null);
  useFrame((_, delta) => {
    const m = knot.current;
    if (m) {
      m.rotation.y += delta * 0.5;
      m.rotation.x += delta * 0.2;
    }
  });
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 6]} intensity={1.4} />
      {/* Orange backdrop the glass refracts (its OWN view scene). */}
      <mesh position={[0, 0, -2]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#ff7a00" />
      </mesh>
      <ReferenceSphere />
      <mesh ref={knot}>
        <torusKnotGeometry args={[1.1, 0.36, 128, 16]} />
        <MeshTransmissionMaterial
          transmission={1}
          thickness={0.5}
          roughness={0.12}
          ior={1.3}
          chromaticAberration={0.5}
          anisotropicBlur={0.2}
          distortion={0.2}
          distortionScale={0.3}
          temporalDistortion={0.1}
          samples={4}
          resolution={256}
          backside={false}
          color="#ffffff"
        />
      </mesh>
    </>
  );
}

/** VIEW B — clouds. The saturated RED probe lives ONLY here; if MTM's FBO in the
 *  glass view leaked a shared scene it would refract through the glass (it must
 *  not — the FBO-isolation proof, same as the spike). */
export function CloudsScene() {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[0, 20, 12]} intensity={1.6} />
      <mesh position={[0, -0.2, -3]}>
        <boxGeometry args={[4, 4, 0.5]} />
        <meshStandardMaterial color="#ff0000" emissive="#330000" />
      </mesh>
      <ReferenceSphere />
      <Clouds material={THREE.MeshLambertMaterial} texture="/textures/cloud-puff.png">
        <Cloud seed={1} segments={20} bounds={[3, 1.5, 1]} volume={5} growth={3} speed={0.3} opacity={0.85} color="white" />
      </Clouds>
    </>
  );
}

/**
 * VIEW C — a scroll-driven color box, mode:"demand". Its useFrame reads scrollY
 * to set rotation + hue, but under frameloop="never" a useFrame only runs on an
 * advance — and the pump only advances a demand view when it's marked dirty. The
 * demo marks it dirty from a scroll listener, so the box turns WHILE scrolling
 * and FREEZES the instant scrolling stops (dirty flag cleared on paint, nothing
 * re-sets it) — the visible proof of demand/markDirty + idle-to-zero.
 */
export function BoxScene() {
  const box = useRef<Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const m = box.current;
    if (!m) return;
    const y = typeof window !== "undefined" ? window.scrollY : 0;
    m.rotation.y = y * 0.002;
    m.rotation.x = y * 0.001;
    if (mat.current) mat.current.color.setHSL((y * 0.0005) % 1, 0.7, 0.55);
  });
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 6]} intensity={1.2} />
      <mesh ref={box}>
        <boxGeometry args={[2.4, 2.4, 2.4]} />
        <meshStandardMaterial ref={mat} color="#3b82f6" />
      </mesh>
    </>
  );
}

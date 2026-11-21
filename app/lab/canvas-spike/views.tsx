"use client";

import { View, Clouds, Cloud, MeshTransmissionMaterial } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { Mesh } from "three";
import { ToneMapping } from "./tone-mapping";

// View indices → drei renders each view's scissored viewport in a useFrame at
// priority = index (View.js). Spaced by 10 so a tone setter can sit at index-1.
const GLASS_INDEX = 10;
const CLOUDS_INDEX = 20;

// Reference-sphere position — same in BOTH views (top-right), so a screenshot
// puts the two side by side and the tone-mapping difference is obvious.
const REF_SPHERE_POS: [number, number, number] = [1.9, 1.3, -0.3];

/**
 * The bright emissive-white reference sphere, IDENTICAL in both views (same
 * geometry + material params). It is toneMapped (standard material default), and
 * its emissive is pushed well past 1.0, so under NoToneMapping (glass view) it
 * clips to flat pure white while under ACESFilmic (clouds view) the highlight
 * rolls off to a softer, slightly desaturated white — the visible proof that the
 * two views render under different tone mapping on ONE shared renderer.
 *
 * NOTE: this is a component (a fresh <meshStandardMaterial> per use), so each
 * view gets its OWN material instance — never a shared one. Sharing a single
 * material across the two tone mappings would force per-frame shader recompiles
 * (see tone-mapping.tsx).
 */
function ReferenceSphere() {
  return (
    <mesh position={REF_SPHERE_POS}>
      <sphereGeometry args={[0.45, 32, 32]} />
      <meshStandardMaterial
        color="#000000"
        emissive="#ffffff"
        emissiveIntensity={3}
        toneMapped
      />
    </mesh>
  );
}

/**
 * VIEW A — "glass". A slowly-rotating MeshTransmissionMaterial torus-knot that
 * MUST render under NoToneMapping. Behind it: a saturated ORANGE background plane
 * (so the transmission FBO has rich content to refract) and the reference sphere.
 * Cheap by design — hardcoded small MTM config (samples 4, resolution 256, no
 * backside). Rotation runs off the per-tick delta (pumped via advance()), so the
 * view repaints continuously while on screen.
 *
 * MTM FBO isolation is proven here: MeshTransmissionMaterial's useFrame renders
 * `state.scene`, which inside this view's portal resolves to the view's OWN
 * virtual scene (View.js portals children into a fresh THREE.Scene). The
 * saturated RED box lives ONLY in View B (clouds) — see CloudsView. If per-view
 * scene isolation were broken and MTM captured a shared/global scene, that red
 * would refract through this glass. It must NOT: correct output shows the orange
 * plane refracted, never red.
 */
export function GlassView({ track }: { track: React.RefObject<HTMLDivElement | null> }) {
  const knot = useRef<Mesh>(null);

  useFrame((_, delta) => {
    const m = knot.current;
    if (m) {
      m.rotation.y += delta * 0.5;
      m.rotation.x += delta * 0.2;
    }
  });

  return (
    <View
      track={track as unknown as React.RefObject<HTMLElement>}
      index={GLASS_INDEX}
    >
      {/* Set NoToneMapping just before this view's render (priority index-1). */}
      <ToneMapping mode={THREE.NoToneMapping} priority={GLASS_INDEX - 1} view="glass" />

      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 6]} intensity={1.4} />

      {/* Saturated background the glass refracts (its OWN scene). */}
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
    </View>
  );
}

/**
 * VIEW B — "clouds". A drei <Clouds>/<Cloud> field (self-hosted sprite
 * public/textures/cloud-puff.png) lit per docs/cloud-color-and-lighting.md
 * (ambient fill + directional key) that MUST render under ACESFilmicToneMapping.
 * Includes the IDENTICAL reference sphere (same params as View A) for the
 * side-by-side tone-mapping comparison, plus the saturated RED contamination
 * probe used by the MTM-isolation check in GlassView.
 *
 * Clouds build their instanced geometry over several frames after a
 * useLayoutEffect, so the first advance()s paint blank — fine here, the pump
 * advances every tick while this view is on screen. Cloud morph rides
 * state.clock delta (compatible with our advance() clock), so after an idle gap
 * the first delta jumps once (noted in the pump).
 */
export function CloudsView({ track }: { track: React.RefObject<HTMLDivElement | null> }) {
  return (
    <View
      track={track as unknown as React.RefObject<HTMLElement>}
      index={CLOUDS_INDEX}
    >
      {/* Set ACESFilmic just before this view's render (priority index-1). */}
      <ToneMapping
        mode={THREE.ACESFilmicToneMapping}
        priority={CLOUDS_INDEX - 1}
        view="clouds"
      />

      {/* Position-independent light rig (cloud-color-and-lighting.md): ambient
          fill + a single white directional key. */}
      <ambientLight intensity={0.9} />
      <directionalLight position={[0, 20, 12]} intensity={1.6} />

      {/* Saturated RED contamination probe — lives ONLY in this view's scene.
          If MTM's FBO in the glass view wrongly captured a shared/global scene,
          this red would refract through that glass. It must not (see GlassView). */}
      <mesh position={[0, -0.2, -3]}>
        <boxGeometry args={[4, 4, 0.5]} />
        <meshStandardMaterial color="#ff0000" emissive="#330000" />
      </mesh>

      <ReferenceSphere />

      <Clouds material={THREE.MeshLambertMaterial} texture="/textures/cloud-puff.png">
        <Cloud
          seed={1}
          segments={20}
          bounds={[3, 1.5, 1]}
          volume={5}
          growth={3}
          speed={0.3}
          opacity={0.85}
          color="white"
        />
      </Clouds>
    </View>
  );
}

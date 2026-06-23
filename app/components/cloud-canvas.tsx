"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Cloud, Clouds } from "@react-three/drei";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Group } from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Volumetric cloud field (Three.js / R3F + drei <Clouds>).
 *
 * Optimization mandate (see docs/cloud-rendering-research.md §9):
 * - frameloop="demand": renders only on mount + invalidate() (scroll). No
 *   free-running rAF; clouds have speed=0 (no autonomous drift).
 * - Single batched <Clouds> draw call; self-hosted sprite texture.
 * - Transparent canvas (alpha) drawing only clouds — color/grain stay DOM.
 * - antialias off, dpr clamped, minimal lights, no shadows.
 *
 * Placement/scale/colour are first-pass and get tuned against the Figma
 * design (node 103:5) in a later pass.
 */

type Layer = {
  /** position [x, y, z] — more negative z = deeper = smaller parallax shift */
  pos: [number, number, number];
  bounds: [number, number, number];
  volume: number;
  segments: number;
  opacity: number;
  /** parallax multiplier (world units of y-shift per full page scroll) */
  parallax: number;
};

const LAYERS: Layer[] = [
  { pos: [3, 2.4, -6], bounds: [7, 2, 2], volume: 6, segments: 26, opacity: 0.5, parallax: 2 },
  { pos: [-3.4, 1.6, -2], bounds: [6, 1.8, 1.8], volume: 5, segments: 22, opacity: 0.65, parallax: 3.4 },
  { pos: [1.4, -0.4, 1], bounds: [5, 1.6, 1.6], volume: 4, segments: 18, opacity: 0.8, parallax: 5 },
];

/** Drives cloud-layer parallax from global page scroll. */
function ParallaxRig({
  groupsRef,
}: {
  groupsRef: React.RefObject<(Group | null)[]>;
}) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const base = LAYERS.map((_, i) => groupsRef.current[i]?.position.y ?? 0);

    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        groupsRef.current.forEach((g, i) => {
          if (g) g.position.y = base[i] - p * LAYERS[i].parallax;
        });
        invalidate();
      },
    });

    return () => st.kill();
  }, [groupsRef, invalidate]);

  return null;
}

export default function CloudCanvas() {
  const groupsRef = useRef<(Group | null)[]>([]);

  return (
    <Canvas
      frameloop="always"
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true }}
      camera={{ position: [0, 0, 10], fov: 45 }}
      style={{ position: "absolute", inset: 0 }}
      onCreated={({ gl, invalidate }) => {
        const canvas = gl.domElement;
        // Recover from GPU context loss (idle reclamation, GPU switches). Without
        // preventDefault the browser won't restore; on restore we redraw (demand
        // mode needs an explicit invalidate to repaint).
        canvas.addEventListener(
          "webglcontextlost",
          (e) => e.preventDefault(),
          false,
        );
        canvas.addEventListener("webglcontextrestored", () => invalidate(), false);
      }}
    >
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 10, 8]} intensity={1.1} />

      <Clouds material={THREE.MeshLambertMaterial} texture="/textures/cloud.png" limit={200}>
        {LAYERS.map((layer, i) => (
          <group
            key={i}
            position={layer.pos}
            ref={(el) => {
              groupsRef.current[i] = el;
            }}
          >
            <Cloud
              seed={i + 1}
              segments={layer.segments}
              bounds={layer.bounds}
              volume={layer.volume}
              opacity={layer.opacity}
              speed={0}
              growth={4}
              color="#ffffff"
            />
          </group>
        ))}
      </Clouds>

      <ParallaxRig groupsRef={groupsRef} />
    </Canvas>
  );
}

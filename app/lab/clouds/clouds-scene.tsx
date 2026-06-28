"use client";

import * as THREE from "three";
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Clouds, Cloud, CameraControls, Sky as SkyImpl, StatsGl } from "@react-three/drei";
import { useControls } from "leva";

/**
 * LAB ONLY — /lab/clouds
 *
 * The drei "Clouds" reference scene (the CodeSandbox the cloud ADR cites),
 * ported to TS. Live-tunable via leva so we can dial in volume/opacity/fade/
 * growth/speed/bounds/colour and read them straight off the panel before
 * porting numbers back into components/background/cloud-canvas.tsx.
 *
 * Faithful to the reference except: `range` is promoted to a real leva control
 * (the original destructured it without defining it, so it was always
 * undefined), and refs are typed + null-guarded for TS.
 */
export default function CloudsScene() {
  return (
    <Canvas camera={{ position: [0, -10, 10], fov: 75 }}>
      <StatsGl />
      <Sky />
      <ambientLight intensity={Math.PI / 1.5} />
      <spotLight position={[0, 40, 0]} decay={0} distance={45} penumbra={1} intensity={100} />
      <spotLight position={[-20, 0, 10]} color="red" angle={0.15} decay={0} penumbra={-1} intensity={30} />
      <spotLight position={[20, -10, 10]} color="red" angle={0.2} decay={0} penumbra={-1} intensity={20} />
      <CameraControls />
    </Canvas>
  );
}

function Sky() {
  const ref = useRef<THREE.Group>(null);
  const cloud0 = useRef<THREE.Group>(null);
  const { color, x, y, z, range, ...config } = useControls({
    seed: { value: 1, min: 1, max: 100, step: 1 },
    segments: { value: 20, min: 1, max: 80, step: 1 },
    volume: { value: 6, min: 0, max: 100, step: 0.1 },
    opacity: { value: 0.8, min: 0, max: 1, step: 0.01 },
    fade: { value: 10, min: 0, max: 400, step: 1 },
    growth: { value: 4, min: 0, max: 20, step: 1 },
    speed: { value: 0.1, min: 0, max: 1, step: 0.01 },
    range: { value: 100, min: 0, max: 400, step: 1 },
    x: { value: 6, min: 0, max: 100, step: 1 },
    y: { value: 1, min: 0, max: 100, step: 1 },
    z: { value: 1, min: 0, max: 100, step: 1 },
    color: "white",
  });
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y = Math.cos(state.clock.elapsedTime / 2) / 2;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime / 2) / 2;
    }
    if (cloud0.current) cloud0.current.rotation.y -= delta;
  });
  return (
    <>
      {/* <SkyImpl /> */}
      <group ref={ref}>
        <Clouds material={THREE.MeshLambertMaterial} limit={400} range={range}>
          <Cloud ref={cloud0} {...config} bounds={[x, y, z]} color={color} />
        </Clouds>
      </group>
    </>
  );
}

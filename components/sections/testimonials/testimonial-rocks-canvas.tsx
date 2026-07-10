"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { GROUP_H, GROUP_W, REVEAL, UNITS } from "./testimonials-data";
import { onTestimonialsRevealStart } from "./testimonials-reveal";

/**
 * The four testimonials rocks as REAL 3D meshes — the "floating 3D rock" the
 * flat sprite couldn't give. One <Canvas> draws all four; each rock tumbles on
 * its own axes and orbits its ring centre. The rings + dots stay as DOM
 * (testimonials.tsx); this canvas layers over them, so a rock overflows and sits
 * in front of its outline exactly as in the Figma.
 *
 * Source model: /rocks/testimonial-rock.v1.glb — the studio GLB (glb2.glb, kept in
 * public/rocks/ as the uncompressed source) optimised for the web via
 * gltf-transform: two 2048² textures → 512² + WebP (the rock renders ~200px, so
 * 2K was wildly oversized) and geometry meshopt-compressed. 8.5 MB → 358 KB
 * (24×). WebP loads natively via GLTFLoader's EXT_texture_webp; the meshopt +
 * KHR_mesh_quantization geometry decodes via the MeshoptDecoder that drei's
 * useGLTF bundles (three-stdlib) — both are self-contained, no CDN/network
 * decoder. Regenerate: `gltf-transform optimize glb2.glb testimonial-rock.vN.glb
 * --texture-compress webp --texture-size 512` then `gltf-transform meshopt`.
 * NOTE: the `.vN.` suffix is load-bearing — the file is served `immutable`
 * (next.config.ts headers), so a same-name overwrite would strand returning
 * visitors on the stale copy for a year. BUMP the version (v1 → v2) whenever the
 * model changes, and update the three refs here + the next.config.ts source.
 *
 * Realism pass (so the rocks sit IN the sky, not on it):
 *  - IBL: a procedural sky-gradient environment (useSkyEnvironment) — the main
 *    lever; PBR needs surroundings to reflect or it looks lit-in-a-void.
 *  - Lights: low ambient + a shaping key (flat ambient was the "clay" tell),
 *    hemisphere/rim keep undersides off near-black — kept light for the Figma.
 *  - AgX tone mapping (was NoToneMapping/`flat`) for photographic highlights.
 *  - Material: metalness 0.2, roughness 0.25 (a glossy wet-stone sheen off the
 *    IBL; was chalky 1.0), normalScale 1.4, envMapIntensity 0.6. (Metalness
 *    forced — glTF's absent factor defaults 1.)
 *
 * Placement: an ORTHOGRAPHIC camera in R3F maps 1 world unit → 1 px, so each
 * rock sits at its exact group-px centre and its `size` reads as px on screen —
 * no perspective drift to fight. The 3D read comes from the mesh + lights +
 * tumble, which is plenty at this scale.
 *
 * Heavy-effect contract (CLAUDE.md):
 * - Rides the shared GSAP ticker — frameloop="never" + advance(); NO private
 *   rAF (React-three's own loop is off). The ticker is added only while the
 *   section is in view or mid-reveal (`paused` from the wrapper's ScrollTrigger),
 *   so it IDLES TO ZERO off-screen.
 * - dpr capped at 1.5. Tier gating + the no-WebGL/reduced-motion/mobile fallback
 *   live in the wrapper (testimonial-rocks.tsx); this file only mounts when 3D
 *   is already chosen.
 * - WARMED AHEAD: the wrapper idle-mounts this canvas (after idle-preloading the
 *   GLB) long before the section is on screen, so useGLTF resolves from cache and
 *   the shader/PMREM/geometry upload happen on a calm main thread. The single
 *   warm frame paints at opacity 0; then zero frames until the reveal fades it in.
 */

useGLTF.preload("/rocks/testimonial-rock.v1.glb");

const TAU = Math.PI * 2;

// Per-unit 3D detune (index-aligned with UNITS). spin = rad/s about x,y,z (the
// tumble); phase = start angles; orbit = a small px circle about the centre.
const MOTION3D = [
  { spin: [0.06, 0.24, 0.04], phase: [0.4, 1.0, 0.2], orbitR: 13, orbitDur: 30, orbitDir: 1, orbitPhase: 0 },
  { spin: [-0.05, -0.2, 0.05], phase: [1.2, 0.3, 1.7], orbitR: 14, orbitDur: 34, orbitDir: -1, orbitPhase: 2.3 },
  { spin: [0.07, 0.28, -0.03], phase: [0.8, 2.1, 0.9], orbitR: 8, orbitDur: 26, orbitDir: 1, orbitPhase: 3.9 },
  { spin: [-0.06, 0.22, 0.06], phase: [2.0, 0.6, 1.3], orbitR: 9, orbitDur: 32, orbitDir: -1, orbitPhase: 5.4 },
] as const;

type Motion = (typeof MOTION3D)[number];

/**
 * A procedural sky-gradient environment map (image-based lighting) — no network
 * asset. Prefiltered through PMREM so the rough rock reads it as soft ambient
 * sky colour + a faint sheen, which is what grounds the rocks IN the scene
 * instead of looking lit-in-a-void. The gradient echoes the page sky, and it's
 * attached to the MATERIAL (not scene.environment) so nothing mutates a hook
 * value and the one-time bake doesn't depend on the (never) render loop.
 */
function buildSkyEnvMap(gl: THREE.WebGLRenderer): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, "#cfe4ff"); // zenith (bright)
  g.addColorStop(0.55, "#7fb2f0"); // sky
  g.addColorStop(1.0, "#e8f2ff"); // horizon / cloud pale
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(gl);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}

/** Centre + normalise the rock mesh; build its matte, sky-lit material. */
function useRockAsset() {
  const { scene } = useGLTF("/rocks/testimonial-rock.v1.glb");
  const gl = useThree((s) => s.gl);

  const asset = useMemo(() => {
    let src: THREE.Mesh | undefined;
    scene.traverse((o) => {
      if (!src && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh;
    });
    if (!src) return null;

    const geometry = src.geometry.clone();
    geometry.center();
    geometry.computeBoundingSphere();
    const r = geometry.boundingSphere?.radius || 1;
    geometry.scale(1 / r, 1 / r, 1 / r); // unit sphere → `size` reads as px

    const env = buildSkyEnvMap(gl);
    const material = (src.material as THREE.MeshStandardMaterial).clone();
    material.metalness = 0.2; // rock, not metal
    material.roughness = 0.25; // was 1.0 (chalky) — let it catch a faint sheen
    material.envMap = env; // sky IBL — grounds it in the scene
    material.envMapIntensity = 0.6;
    material.normalScale?.set(1.4, 1.4); // deepen surface relief
    material.side = THREE.DoubleSide;
    // Start invisible + (via Rock) off-screen: the fly-in reveal snaps the shared
    // material visible (opacity → 1, Scene) and eases each rock in from beyond the
    // viewport. transparent stays on (depthWrite is still true, so faces occlude
    // normally — no ghosting); the 4 rocks don't overlap, so blend cost is nil.
    material.transparent = true;
    material.opacity = 0;
    material.needsUpdate = true;

    return { geometry, material, env };
  }, [scene, gl]);

  useEffect(() => {
    if (!asset) return;
    return () => {
      asset.geometry.dispose();
      asset.material.dispose();
      asset.env.dispose();
    };
  }, [asset]);

  return asset;
}

function Rock({
  unit,
  motion,
  index,
  geometry,
  material,
  register,
}: {
  unit: (typeof UNITS)[number];
  motion: Motion;
  index: number;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  register: (fn: (t: number) => void) => () => void;
}) {
  const orbit = useRef<THREE.Group>(null);
  const tumble = useRef<THREE.Group>(null);
  const baseX = unit.cx - GROUP_W / 2;
  const baseY = -(unit.cy - GROUP_H / 2);

  // Fly-in offset (px), added to the orbit position by the pump each frame. It
  // starts at base × (flyFactor − 1) — so the rock begins at base × flyFactor,
  // well outside the viewport, along its own outward radial (the four thus arrive
  // from four directions) — and the reveal eases it to 0, landing on the ring.
  const offset = useRef({
    x: baseX * (REVEAL.flyFactor - 1),
    y: baseY * (REVEAL.flyFactor - 1),
  });

  // The float: a slow orbit + 3D tumble about the base, plus the fly-in offset.
  useEffect(() => {
    return register((t) => {
      const a = motion.orbitPhase + t * (TAU / motion.orbitDur) * motion.orbitDir;
      orbit.current?.position.set(
        baseX + Math.cos(a) * motion.orbitR + offset.current.x,
        baseY + Math.sin(a) * motion.orbitR + offset.current.y,
        0,
      );
      tumble.current?.rotation.set(
        motion.phase[0] + t * motion.spin[0],
        motion.phase[1] + t * motion.spin[1],
        motion.phase[2] + t * motion.spin[2],
      );
    });
  }, [register, motion, baseX, baseY]);

  // Fly in from off-screen when the shared gate fires: ease the offset → 0. The
  // pump (already running for the reveal) renders every frame of it. Subscribing
  // means a rock that mounts AFTER the gate fired (anchor-jump) still flies in.
  useEffect(() => {
    let tween: gsap.core.Tween | undefined;
    const unsub = onTestimonialsRevealStart(() => {
      tween = gsap.to(offset.current, {
        x: 0,
        y: 0,
        duration: REVEAL.flyDur,
        delay: REVEAL.flyDelay(index),
        ease: REVEAL.flyEase,
      });
    });
    return () => {
      unsub();
      tween?.kill();
    };
  }, [index]);

  return (
    <group ref={orbit} position={[baseX, baseY, 0]}>
      <group ref={tumble} rotation={[motion.phase[0], motion.phase[1], motion.phase[2]]}>
        <mesh geometry={geometry} material={material} scale={unit.size / 2} />
      </group>
    </group>
  );
}

function Scene({ paused }: { paused: boolean }) {
  const asset = useRockAsset();
  const advance = useThree((s) => s.advance);
  const updaters = useRef(new Set<(t: number) => void>());

  const register = useCallback((fn: (t: number) => void) => {
    updaters.current.add(fn);
    return () => {
      updaters.current.delete(fn);
    };
  }, []);

  // The render pump. frameloop="never", so a frame paints only when this calls
  // advance(). It rides the shared GSAP ticker (LenisProvider's one loop) — no
  // private rAF — which keeps ticking DURING scroll, so the reveal animates as
  // you scroll in.
  //
  // ⚠️ Why this is imperative, not a plain `if (paused) …` effect: the reveal
  // must START the pump the instant the shared gate fires, and that happens
  // SYNCHRONOUSLY inside the scroll's IntersectionObserver callback. A React
  // effect keyed on the `paused` prop is a PASSIVE effect — deferred while the
  // main thread is busy scrolling — so the pump (and the rocks) only appeared
  // once you STOPPED scrolling, while the rings (plain GSAP, fired in the same
  // IO callback) revealed on time. So the gate turns the pump on synchronously
  // (renders mid-scroll, in lockstep with the rings); `paused` only governs
  // idling to zero once the reveal is over.
  const pump = useCallback(
    (t: number) => {
      for (const fn of updaters.current) fn(t);
      advance(t * 1000);
    },
    [advance],
  );

  const pausedRef = useRef(paused);
  const revealingRef = useRef(false);
  const addedRef = useRef(false);
  const sync = useCallback(() => {
    const want = !pausedRef.current || revealingRef.current;
    if (want && !addedRef.current) {
      gsap.ticker.add(pump);
      addedRef.current = true;
    } else if (!want && addedRef.current) {
      gsap.ticker.remove(pump);
      addedRef.current = false;
    }
  }, [pump]);

  useEffect(() => {
    pausedRef.current = paused;
    sync();
  }, [paused, sync]);

  useEffect(() => {
    if (!asset) return;
    const mat = asset.material;
    // Keep the pump alive until the last rock has landed (+ a little slack).
    const revealTotal = REVEAL.flyDelay(UNITS.length - 1) + REVEAL.flyDur + 0.4;
    let done: gsap.core.Tween | undefined;
    let fade: gsap.core.Tween | undefined;
    const unsub = onTestimonialsRevealStart(() => {
      revealingRef.current = true;
      sync(); // synchronous — pump starts mid-scroll, so the fly-in renders live
      // Snap the shared material visible (all four at once). The rocks are still
      // off-screen at this instant, so this quick fade is essentially unseen — it
      // only softens the edge as each rock crosses into view. The per-rock fly-in
      // lives in Rock; the rings draw in after (testimonials-drift.tsx).
      fade = gsap.to(mat, { opacity: 1, duration: 0.3, ease: "none" });
      done = gsap.delayedCall(revealTotal, () => {
        revealingRef.current = false;
        sync();
      });
    });
    return () => {
      unsub();
      done?.kill();
      fade?.kill();
      if (addedRef.current) {
        gsap.ticker.remove(pump);
        addedRef.current = false;
      }
    };
  }, [sync, pump, asset]);

  // Warm the pipeline before the section arrives: one render compiles the shader
  // program and uploads geometry/textures NOW, at the idle mount, so the reveal
  // later is pure animation — nothing left to load or compile. A single paint,
  // not a loop; the material starts at opacity 0 (and the rocks off-screen), so
  // this warm frame is invisible.
  useEffect(() => {
    if (!asset) return;
    advance(performance.now());
  }, [asset, advance]);

  if (!asset) return null;

  return (
    <>
      {/* With the sky IBL (useSkyEnvironment) now carrying the fill, ambient is
          low again so the form reads (flat ambient was the "clay" tell); the key
          does the shaping and the hemisphere + rim keep the undersides from the
          old near-black. Kept light overall to match the Figma. */}
      <ambientLight intensity={0.3} />
      <hemisphereLight args={[0xdcecff, 0x9fc4e8, 1.0]} />
      <directionalLight color={0xfff4e0} intensity={1.35} position={[4, 6, 6]} />
      <directionalLight color={0xbfe0ff} intensity={0.6} position={[-5, -2, -4]} />
      {UNITS.map((u, i) => (
        <Rock
          key={i}
          unit={u}
          motion={MOTION3D[i % MOTION3D.length]}
          index={i}
          geometry={asset.geometry}
          material={asset.material}
          register={register}
        />
      ))}
    </>
  );
}

export default function TestimonialRocksCanvas({ paused }: { paused: boolean }) {
  return (
    <Canvas
      orthographic
      dpr={[1, 1.5]}
      frameloop="never"
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        // AgX gives a photographic highlight roll-off — replaces the flat/clipped
        // NoToneMapping ("digital" look). Exposure lifts AgX's slight darkening.
        toneMapping: THREE.AgXToneMapping,
        toneMappingExposure: 1.15,
      }}
      camera={{ position: [0, 0, 100], zoom: 1, near: 0.1, far: 1000 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Suspense fallback={null}>
        <Scene paused={paused} />
      </Suspense>
    </Canvas>
  );
}

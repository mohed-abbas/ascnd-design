"use client";

import { Canvas, useThree } from "@react-three/fiber";
import {
  Center,
  MeshTransmissionMaterial,
  Text3D,
  useTexture,
} from "@react-three/drei";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { GlassEnvironment } from "@/components/sections/intro/intro-scene";
import { getQualityConfig } from "@/lib/perf/quality-store";
import { makeCappedInvalidate } from "@/lib/perf/capped-invalidate";
import { useMode } from "@/lib/theme/use-mode";
import { PALETTES } from "@/lib/theme/palette";

/**
 * Footer liquid-glass "ascnd" — the SAME glass as the welcome intro, reused as the
 * closing brand payoff. This is "naive Option B" (see memory footer-glass-wordmark):
 * the mountains render as a textured PLANE inside this WebGL scene, behind the
 * letters, so the glass refracts the real, pixel-aligned peaks (the exact trick the
 * intro uses for its rock planes). The material + <GlassEnvironment> are the
 * production values lifted from intro-scene.tsx so the glass looks identical.
 *
 * Perspective camera (z=10, fov=45 — the lab/glass + cloud convention) so the glass
 * refracts/disperses richly. Transparent canvas (alpha): the mountain plane's sky
 * is transparent, so above the ridgeline the canvas shows through to the shared DOM
 * sky + live clouds, and the glass's `background` sky colour fills the transmission
 * where the letters sit over open sky.
 *
 * PHASE 1 (feature-first): renders on demand with a mount burst + an on-screen
 * repaint gate for the shimmer — enough that the heaviest shader in the app doesn't
 * run while the footer is off-screen, but NOT the full tier/eligibility gating and
 * static fallback (that's Phase 2). Placement is self-sized off the viewport and
 * driven by the TUNING constants below — eyeball + adjust.
 */

const FONT = "/fonts/product-sans-medium.typeface.json";
const MOUNTAIN_SRC = "/footer/footer-scene.webp";
const MOUNTAIN_ASPECT = 3168 / 1344; // intrinsic w/h of the mountain cutout

// Glass "ascnd" width ≈ 2.55 × Text3D `size` (advances + tracking) — same as intro.
const WIDTH_PER_SIZE = 2.55;

// ── TUNING (visual) ────────────────────────────────────────────────────────
const CAMERA_Z = 10;
// How much of the view width the wordmark spans (0..1).
const GLASS_WIDTH_FRAC = 0.84;
// Wordmark vertical position, as a fraction of the view HEIGHT from centre
// (negative = below centre, so the letters straddle the ridgeline / lower peaks).
// Figma sits it ~15% below centre, letters cutting across the peaks.
const GLASS_Y_FRAC = -0.15;
// How far behind the glass (z) the mountain plane sits — enough that the glass
// clearly refracts it, not so far it shrinks. World units, negative = away.
const MOUNTAIN_Z = -1.2;
// Bevel proportions are authored against the intro's ~4.6-world glass size; scale
// them with our size so the edge highlight matches at any viewport.
const INTRO_GLASS_SIZE = 4.6;
const BEVEL_THICKNESS_RATIO = 0.175 / INTRO_GLASS_SIZE;
const BEVEL_SIZE_RATIO = 0.095 / INTRO_GLASS_SIZE;
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The mountain range as a textured plane behind the glass — the glass's refraction
 * source. Full view width (compensated for its depth so it still fills the frame),
 * bottom-anchored to the view edge, its transparent sky letting the canvas show
 * through to the shared DOM sky above the peaks. Unlit basic material (toneMapped
 * off) so it reads as the flat photo it is.
 */
function Mountains() {
  const tex = useTexture(MOUNTAIN_SRC);
  const viewport = useThree((s) => s.viewport);

  // The plane sits at MOUNTAIN_Z (behind the z=0 plane the viewport is measured
  // at), so scale it up by the depth ratio to still fill the frame edge-to-edge.
  const depth = (CAMERA_Z - MOUNTAIN_Z) / CAMERA_Z;
  const w = viewport.width * depth;
  const h = w / MOUNTAIN_ASPECT;
  // Bottom edge of the (depth-scaled) view, then lift by half the plane height so
  // the mountains sit flush to the bottom of the footer.
  const y = (-viewport.height / 2) * depth + h / 2;

  return (
    <mesh position={[0, y, MOUNTAIN_Z]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}

/**
 * The glass wordmark — the intro's exact Text3D + MeshTransmissionMaterial. Sized
 * so it spans GLASS_WIDTH_FRAC of the view and sits at GLASS_Y_FRAC down the frame,
 * across the peaks. Static here (no intro reveal/dock) — the living shimmer comes
 * from the material's temporalDistortion, pumped by the paint gate below.
 */
function Glass() {
  const viewport = useThree((s) => s.viewport);
  const mode = useMode();
  // Fills the transmission where the letters sit over open sky (no plane behind),
  // tied to the current sky mode so it matches a themed backdrop. day.mid === #62abff.
  const sky = useMemo(() => new THREE.Color(PALETTES[mode].sky.mid), [mode]);
  // Snapshot the quality tier once (MTM FBO cost knobs) — same as the intro.
  const q = useMemo(() => getQualityConfig(), []);

  const size = (viewport.width * GLASS_WIDTH_FRAC) / WIDTH_PER_SIZE;
  const y = viewport.height * GLASS_Y_FRAC;

  return (
    <group position={[0, y, 0]}>
      <Center key={size}>
        <Text3D
          font={FONT}
          size={size}
          height={0}
          curveSegments={q.text3dCurveSegments}
          bevelEnabled
          bevelThickness={size * BEVEL_THICKNESS_RATIO}
          bevelSize={size * BEVEL_SIZE_RATIO}
          bevelOffset={0}
          bevelSegments={q.text3dBevelSegments}
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
            samples={q.mtmSamples}
            resolution={q.mtmResolution}
            backside={q.mtmBackside}
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

/**
 * Demand-mode paint gate. drei's MTM + Text3D build over several frames, so we
 * burst invalidate() after mount (plus a few delayed nudges for texture/HDR decode)
 * to guarantee a painted glass. Then, ONLY while the footer canvas is on screen, we
 * pump the demand loop off GSAP's shared ticker (capped) so the material's shimmer
 * lives — and stop entirely when it scrolls away, so the app's heaviest shader
 * idles to zero off-screen (rides the "one loop" mandate; no private rAF loop for
 * the steady state). Repaints once more on tab re-show.
 */
function PaintGate() {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    // Mount burst — cover the multi-frame geometry/texture build.
    let raf = 0;
    let frames = 0;
    const pump = () => {
      invalidate();
      if (++frames < 10) raf = requestAnimationFrame(pump);
    };
    pump();
    const timers = [100, 300, 600].map((ms) => setTimeout(invalidate, ms));

    // On-screen shimmer pump, gated by visibility of the canvas element.
    const capped = makeCappedInvalidate(invalidate);
    let onScreen = false;
    const tick = () => {
      if (onScreen) capped();
    };
    gsap.ticker.add(tick);

    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) invalidate(); // repaint immediately on entry
      },
      { rootMargin: "10% 0px" },
    );
    io.observe(gl.domElement);

    const onVisible = () => {
      if (document.visibilityState === "visible") invalidate();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      gsap.ticker.remove(tick);
      capped.cancel();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [invalidate, gl]);

  return null;
}

export default function FooterGlassScene() {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, CAMERA_Z], fov: 45 }}
      onCreated={({ gl }) => {
        // Match the lab/glass render: the bright env carries the white, so no
        // ACES roll-off (which greys the glass + mountains).
        gl.toneMapping = THREE.NoToneMapping;
      }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <Suspense fallback={null}>
        <Mountains />
        <Glass />
        {/* Bevel sheen — the exact studio glints the intro/lab use. */}
        <GlassEnvironment />
        <directionalLight position={[3, 5, 6]} intensity={1.2} />
        <ambientLight intensity={0.4} />
        <PaintGate />
      </Suspense>
    </Canvas>
  );
}

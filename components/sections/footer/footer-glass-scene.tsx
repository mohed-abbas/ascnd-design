"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Center,
  MeshTransmissionMaterial,
  Text3D,
  useFont,
  useTexture,
} from "@react-three/drei";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import type { Group } from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { GlassEnvironment } from "@/components/sections/intro/intro-scene";
import { getQualityConfig, heavyEffectFpsCap } from "@/lib/perf/quality-store";
import { useMode } from "@/lib/theme/use-mode";
import { CROSSFADE, PALETTES } from "@/lib/theme/palette";
import { makeSkyBackdrop } from "@/lib/theme/sky-backdrop";
import { FOOTER_GLASS } from "./footer-glass-config";

gsap.registerPlugin(ScrollTrigger);

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
 * sky. SURROUNDINGS AWARENESS: the transmission `background` is a gradient texture
 * of the real sky stops (makeSkyBackdrop — not a flat colour), retinted with the
 * theme mode, so the glass shows the actual graded sky. (No invented elements: the
 * glass refracts only what the footer really has — sky + mountains. DOM-layer
 * clouds can't appear in the refraction; MTM only sees its own scene.) Canvas is
 * mounted IN-FLOW by footer-scene, so the mountains scroll with the page (the DOM
 * clouds drift on their fixed layers) — the parallax is preserved.
 *
 * Three optional flourishes, each behind a switch in footer-glass-config.ts:
 * pointer tilt, an in-scene reveal (the wordmark slides up from BEHIND the
 * ridgeline — the mountain plane occludes it), and a themed-backdrop tween.
 *
 * Painting is REQUEST-DRIVEN (frameloop="never"): anything that changes visible
 * state calls requestPaint(), and the RenderPump drains those requests off the
 * shared GSAP ticker (capped by heavyEffectFpsCap) while the footer is on screen —
 * so scroll-driven changes paint DURING the scroll, and when nothing changes the
 * heaviest shader in the app renders NOTHING, on-screen or off. Temporal
 * distortion is deliberately 0: any nonzero value animates forever and would force
 * a permanent repaint loop (the static distortion keeps the liquid look).
 * Eligibility + a DEFERRED mount + the static fallback live one level up in
 * footer-scene.tsx; the mtm + text3d tier knobs come from getQualityConfig.
 * dpr capped 1.5.
 *
 * Placement is self-sized off the viewport and driven by the TUNING constants below
 * — eyeball + adjust.
 */

const FONT = "/fonts/product-sans-medium.typeface.json";
const MOUNTAIN_SRC = "/footer/footer-scene.webp";
// Intrinsic w/h of the mountain cutout. Downsized 3168×1344 → 2046×868 (S1,
// docs/glass-loading-and-performance-2026-07-12.md) — the SAME 33:14 ratio, so
// the plane geometry is unchanged; ~2.5× less VRAM and a faster warm-burst
// upload, imperceptible through the refraction (see that doc's S1 rationale).
const MOUNTAIN_ASPECT = 2046 / 868;

// Prime the heavyweight payloads the moment this chunk arrives — footer-scene
// warms the chunk itself well ahead of arrival (warmFooterGlass), so by the time
// the canvas mounts, both are cache hits. The font is already cached when the
// intro played; this covers intro-skipped loads.
useTexture.preload(MOUNTAIN_SRC);
useFont.preload(FONT);

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

// Letters that sit IN FRONT of the peaks — x-bands as fractions of the wordmark
// width (0 = left edge of "ascnd", 1 = right edge). The mountain occluder skips
// these columns, so "c" and "d" ride in front of the ridge while a/s/n tuck
// behind it. Eyeball against the silhouette.
const FRONT_LETTER_BANDS = [
  [0.36, 0.62], // c
  [0.78, 1.04], // d
] as const;

// Reveal (when FOOTER_GLASS.glassReveal): the glass parks this fraction of the view
// height below its rest — tucked behind the ridgeline — and slides up to rest as
// the footer scrolls in (scrubbed, reversible). Keep it modest: the visible part
// of the slide is only the stretch above the silhouette, so a deep tuck spends the
// whole scrub hidden and the letters "pop" at the very end.
const REVEAL_RISE_FRAC = 0.2;
// The scrub window: starts when this fraction down the scene box reaches the
// viewport bottom (≈ when the ridge zone shows up), ends at the page bottom.
const REVEAL_START_FRAC = 0.5;
// Ease-out exponent on the scrub progress (1 = linear). >1 front-loads the rise so
// the letters crest the ridge through the middle of the window, not all at the end.
const REVEAL_EASE_POW = 2;
// Pointer tilt (when FOOTER_GLASS.pointerTilt): max radians + follow easing.
const TILT_X = 0.1;
const TILT_Y = 0.16;
const TILT_LERP = 0.06;
// The liquid distortion is STATIC (see header): 0.28 (the intro's value) wobbled
// permanently — "too much" — and forced a permanent repaint loop.
const MTM_TEMPORAL_DISTORTION = 0;

// Frames to paint after mount / context restore: drei builds geometry, uploads
// textures and compiles the MTM shader over several frames, so a single frame
// can paint blank (same lesson as cloud-canvas's InvalidateOnReady burst).
const MOUNT_BURST_FRAMES = 30;
// How many painted frames count as "the scene is genuinely on screen" — past the
// env-map build and shader settle. RenderPump fires onReady here, releasing the
// baked poster that covers the spin-up (footer-scene.tsx).
const READY_FRAMES = 6;
// ─────────────────────────────────────────────────────────────────────────────

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Paint scheduler (frameloop="never"): state-changers request frames, the
 * RenderPump drains them off the shared ticker while the footer is on screen.
 * `pending` is a high-water mark, not a queue — concurrent requesters coalesce to
 * one advance per ticker frame. Zero pending = zero GPU: this is how the app's
 * heaviest shader satisfies the "idles to zero" contract even while visible.
 * Module scope (one live canvas; a remount inherits any pending burst, which is
 * harmless — at worst it repaints the same settled frame).
 */
const paint = { pending: 0 };
const requestPaint = (frames = 1) => {
  paint.pending = Math.max(paint.pending, frames);
};


/**
 * The mountain range — the glass's refraction source AND its selective occluder.
 * Two draws of the same texture:
 *  - BASE: a full-width plane behind the glass (normal depth). This is what the
 *    letters refract, and what "c"/"d" ride in front of.
 *  - OCCLUDER SLICES: the same image re-painted AFTER the glass (renderOrder, depth
 *    test off) so its opaque pixels cover the letters — but sliced to SKIP the
 *    FRONT_LETTER_BANDS columns. Result: a/s/n tuck behind the ridgeline (and the
 *    wordmark slides up from behind it — that occlusion IS the reveal, no fades)
 *    while c/d stay in front of the peaks for the interleaved depth effect.
 * In the transmission buffer draw order is irrelevant, so the refraction still sees
 * one seamless range. Full view width (compensated for depth so it fills the
 * frame), bottom-anchored, transparent sky showing the DOM sky + clouds through.
 */
function Mountains() {
  const tex = useTexture(MOUNTAIN_SRC);
  const viewport = useThree((s) => s.viewport);

  const depth = (CAMERA_Z - MOUNTAIN_Z) / CAMERA_Z;
  const w = viewport.width * depth;
  const h = w / MOUNTAIN_ASPECT;
  const y = (-viewport.height / 2) * depth + h / 2;

  // Occluder slice geometries: the spans BETWEEN the front-letter bands (band
  // fractions are of the wordmark width at the glass plane, projected out to the
  // mountain plane by the same depth factor), with UVs remapped so each slice
  // samples exactly its column of the texture — seamless against the base.
  const slices = useMemo(() => {
    const wordW = viewport.width * GLASS_WIDTH_FRAC * depth;
    const edges: number[] = [-w / 2];
    for (const [f0, f1] of FRONT_LETTER_BANDS) {
      edges.push((f0 - 0.5) * wordW, (f1 - 0.5) * wordW);
    }
    edges.push(w / 2);
    const out: { geom: THREE.PlaneGeometry; x: number }[] = [];
    for (let i = 0; i < edges.length; i += 2) {
      const x0 = Math.max(edges[i], -w / 2);
      const x1 = Math.min(edges[i + 1], w / 2);
      if (x1 - x0 <= 0) continue;
      const geom = new THREE.PlaneGeometry(x1 - x0, h);
      const uv = geom.attributes.uv as THREE.BufferAttribute;
      for (let j = 0; j < uv.count; j++) {
        uv.setX(j, (x0 + uv.getX(j) * (x1 - x0)) / w + 0.5);
      }
      out.push({ geom, x: (x0 + x1) / 2 });
    }
    return out;
  }, [viewport.width, depth, w, h]);

  useEffect(() => {
    return () => slices.forEach((s) => s.geom.dispose());
  }, [slices]);

  return (
    <>
      <mesh position={[0, y, MOUNTAIN_Z]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
      {slices.map((s, i) => (
        <mesh
          key={i}
          geometry={s.geom}
          position={[s.x, y, MOUNTAIN_Z]}
          renderOrder={2}
        >
          <meshBasicMaterial
            map={tex}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

/**
 * The glass wordmark — the intro's exact Text3D + MeshTransmissionMaterial. Sized so
 * it spans GLASS_WIDTH_FRAC of the view and sits at GLASS_Y_FRAC down the frame,
 * across the peaks. Optional flourishes (all switched in footer-glass-config):
 *  - pointer tilt: the group eases toward a cursor-driven tilt every painted frame;
 *  - reveal: the group slides up from behind the ridgeline (the Mountains plane
 *    occludes it — no fade), driven by the shared `reveal` scrub.
 * `background` is the sky-gradient backdrop texture (see makeSkyBackdrop) — it
 * fills the transmission where the letters sit over open sky; the theme effect in
 * FooterGlassScene retints it in place.
 */
function Glass({
  revealRef,
  background,
}: {
  revealRef: React.RefObject<number>;
  background: THREE.Texture;
}) {
  const viewport = useThree((s) => s.viewport);

  // Snapshot the quality tier once (MTM FBO cost knobs) — same as the intro.
  const q = useMemo(() => getQualityConfig(), []);

  const groupRef = useRef<Group>(null);
  const tilt = useRef({ x: 0, y: 0 });

  const size = (viewport.width * GLASS_WIDTH_FRAC) / WIDTH_PER_SIZE;
  const restY = viewport.height * GLASS_Y_FRAC;
  const rise = viewport.height * REVEAL_RISE_FRAC;

  // Pointer tilt: track the cursor in normalised viewport coords. Each move
  // requests a frame; the useFrame easing below keeps requesting until settled.
  useEffect(() => {
    if (!FOOTER_GLASS.pointerTilt) return;
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -((e.clientY / window.innerHeight) * 2 - 1);
      tilt.current.x = ny * TILT_X;
      tilt.current.y = nx * TILT_Y;
      requestPaint();
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;

    // Reveal: slide up from behind the ridge (glassReveal off → parked at rest).
    // No opacity — the Mountains occluder IS the reveal. Ease-out front-loads the
    // rise so the crest happens mid-window instead of bunching at the end.
    const gp = FOOTER_GLASS.glassReveal
      ? 1 - Math.pow(1 - clamp01(revealRef.current), REVEAL_EASE_POW)
      : 1;
    g.position.set(0, restY - (1 - gp) * rise, 0);
    // Fully tucked → skip drawing the expensive glass mesh entirely.
    g.visible = gp > 0.001;

    // Pointer tilt: ease the group toward the cursor-driven target, requesting
    // frames until the lerp settles (self-sustaining, then back to zero).
    if (FOOTER_GLASS.pointerTilt) {
      const dx = tilt.current.x - g.rotation.x;
      const dy = tilt.current.y - g.rotation.y;
      g.rotation.x += dx * TILT_LERP;
      g.rotation.y += dy * TILT_LERP;
      if (Math.abs(dx) > 1e-3 || Math.abs(dy) > 1e-3) requestPaint();
    }
  });

  return (
    <group ref={groupRef} position={[0, restY, 0]}>
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
            background={background}
            transmission={1}
            thickness={0.3}
            roughness={0.31}
            ior={1.28}
            chromaticAberration={0.65}
            anisotropicBlur={0.28}
            distortion={0.2}
            distortionScale={0.4}
            temporalDistortion={MTM_TEMPORAL_DISTORTION}
            samples={q.mtmSamples}
            resolution={q.mtmResolutionFooter}
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
 * In-scene reveal driver (when FOOTER_GLASS.glassReveal). A scrub ScrollTrigger on
 * the footer scene box maps its scroll-in DIRECTLY to `reveal` 0..1: the wordmark
 * slides up from behind the ridgeline in step with the mountains riding into view,
 * and tucks back behind them on reverse — fully scroll-bound, both directions,
 * never waiting for a scroll to stop. It only WRITES the progress; the RenderPump
 * (frameloop="never" + advance() on the shared ticker) paints it every frame
 * DURING the scroll. The window starts at REVEAL_START_FRAC down the box (≈ when
 * the ridge zone reaches the viewport — earlier progress would slide the glass
 * while its region is still off-screen, which reads as a pop at the end) and ends
 * as the box bottom meets the page bottom, so the reveal completes exactly as the
 * scroll settles. onRefresh seeds the progress for deep links / scroll restores.
 */
function RevealRig({ revealRef }: { revealRef: React.RefObject<number> }) {
  useEffect(() => {
    const box = document.querySelector<HTMLElement>("[data-footer-scene]");
    if (!box) {
      revealRef.current = 1;
      return;
    }

    const st = ScrollTrigger.create({
      trigger: box,
      start: `${REVEAL_START_FRAC * 100}% bottom`,
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        revealRef.current = self.progress;
        requestPaint();
      },
      onRefresh: (self) => {
        revealRef.current = self.progress;
        requestPaint();
      },
    });

    return () => st.kill();
  }, [revealRef]);

  return null;
}

/**
 * Render pump — drains requestPaint() requests (see the paint scheduler at the
 * top) by advance()-ing the frameloop="never" canvas off the shared GSAP ticker
 * (LenisProvider's one loop), which keeps ticking through a scroll — so
 * scroll-driven changes paint DURING the scroll. A demand canvas + invalidate()
 * did NOT do this: the paint was deferred until the scroll settled. And because
 * only REQUESTED frames paint, a settled scene costs zero GPU (the canvas keeps
 * showing its last painted frame) — so the pump rides the ticker permanently
 * while mounted: a tick with nothing pending is a no-op, and the old
 * IntersectionObserver on/off gate was pure complexity (scroll rigs only fire
 * in range anyway). Paints are capped by heavyEffectFpsCap so a 120 Hz panel
 * doesn't pay double for the heavy MTM.
 *
 * A warm advance at mount + a MOUNT_BURST covers drei's multi-frame build
 * (shader compile, texture upload, env PMREM) — and since the canvas mounts
 * viewports ahead of arrival (footer-scene), the burst finishes the warm-up
 * BEFORE the footer is reached. Once READY_FRAMES real frames have painted,
 * `onReady` fires and footer-scene fades its baked poster off the live canvas.
 * A resize relayouts (Center re-centres) and repaints; a tab re-show repaints.
 */
function RenderPump({ onReady }: { onReady?: () => void }) {
  const advance = useThree((s) => s.advance);
  const size = useThree((s) => s.size);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Resize → re-render at the new proportions (also fires at mount, where it
  // merges into the mount burst below).
  useEffect(() => {
    requestPaint(3);
  }, [size]);

  useEffect(() => {
    // Warm the pipeline synchronously (compile MTM/Text3D shaders, upload
    // geometry), then burst frames — drei finishes building async.
    advance(performance.now());
    requestPaint(MOUNT_BURST_FRAMES);

    let painted = 1; // the warm advance above
    let last = 0;
    const pump = (t: number) => {
      if (paint.pending <= 0) return;
      const cap = heavyEffectFpsCap();
      if (cap !== 0 && t - last < 1 / cap) return;
      last = t;
      paint.pending -= 1;
      advance(t * 1000);
      painted += 1;
      if (painted === READY_FRAMES) onReadyRef.current?.();
    };
    gsap.ticker.add(pump);

    const onVisible = () => {
      if (document.visibilityState === "visible") requestPaint();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      gsap.ticker.remove(pump);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [advance]);

  return null;
}

/**
 * WebGL context-loss safety net (mirrors cloud-canvas's watchdog). THREE handles
 * lost/restored internally; here we (a) repaint after a restore (demand mode needs
 * an explicit frame) and (b) if a restore never arrives within a few seconds
 * (unrecoverable driver reset) on a still-live, visible canvas, ask the parent to
 * remount the <Canvas> with a fresh context. All listeners/timers are cleaned up.
 */
function ContextWatchdog({ onUnrecoverable }: { onUnrecoverable: () => void }) {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    let mounted = true;
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;

    const onLost = () => {
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => {
        if (
          mounted &&
          canvas.isConnected &&
          document.visibilityState === "visible"
        ) {
          onUnrecoverable();
        }
      }, 4000);
    };
    const onRestored = () => {
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = undefined;
      // Fresh context = shaders/textures re-upload over several frames.
      requestPaint(MOUNT_BURST_FRAMES);
    };

    canvas.addEventListener("webglcontextlost", onLost, false);
    canvas.addEventListener("webglcontextrestored", onRestored, false);

    return () => {
      mounted = false;
      if (restoreTimer) clearTimeout(restoreTimer);
      canvas.removeEventListener("webglcontextlost", onLost, false);
      canvas.removeEventListener("webglcontextrestored", onRestored, false);
    };
  }, [gl, onUnrecoverable]);

  return null;
}

export default function FooterGlassScene({
  onReady,
}: {
  /** Fired once the scene has painted real frames — releases the poster. */
  onReady?: () => void;
}) {
  // Bumping this remounts the <Canvas> with a fresh GL context — last resort when
  // a lost context never restores. See <ContextWatchdog>.
  const [canvasKey, setCanvasKey] = useState(0);
  const remount = useCallback(() => setCanvasKey((k) => k + 1), []);
  const mode = useMode();

  // Shared reveal progress (0..1). 1 when the in-scene reveal is off, so the scene
  // renders fully resolved and the DOM box reveal (footer-reveal) handles entrance.
  const revealRef = useRef(FOOTER_GLASS.glassReveal ? 0 : 1);

  // Sky-gradient backdrop — a stable object mutated in place on a theme change
  // (React never re-renders for a retint).
  const [sky] = useState(() => makeSkyBackdrop(mode));
  useEffect(() => {
    return () => sky.texture.dispose();
  }, [sky]);

  // Theme retint: on a sky-mode change, tween (or snap, per the themeTween
  // switch) the gradient stops, redrawing the backdrop and requesting a paint per
  // step. First run is a no-op — the backdrop is built from the mount mode. (A
  // change while off-screen just accrues pending frames; the pump shows the
  // settled colours when you next reach the footer.)
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) {
      firstMode.current = false;
      return;
    }
    const target = PALETTES[mode];
    const to = {
      top: new THREE.Color(target.sky.top),
      mid: new THREE.Color(target.sky.mid),
      bottom: new THREE.Color(target.sky.bottom),
    };
    if (!FOOTER_GLASS.themeTween) {
      sky.stops.top.copy(to.top);
      sky.stops.mid.copy(to.mid);
      sky.stops.bottom.copy(to.bottom);
      sky.redraw();
      requestPaint();
      return;
    }
    const from = {
      top: sky.stops.top.clone(),
      mid: sky.stops.mid.clone(),
      bottom: sky.stops.bottom.clone(),
    };
    const proxy = { p: 0 };
    const tween = gsap.to(proxy, {
      p: 1,
      duration: CROSSFADE.duration,
      ease: CROSSFADE.ease,
      onUpdate: () => {
        sky.stops.top.copy(from.top).lerp(to.top, proxy.p);
        sky.stops.mid.copy(from.mid).lerp(to.mid, proxy.p);
        sky.stops.bottom.copy(from.bottom).lerp(to.bottom, proxy.p);
        sky.redraw();
        requestPaint();
      },
    });
    return () => {
      tween.kill();
    };
  }, [mode, sky]);

  return (
    <Canvas
      key={canvasKey}
      frameloop="never"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, stencil: false }}
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
        <Glass revealRef={revealRef} background={sky.texture} />
        {/* Bevel sheen — the exact studio glints the intro/lab use. */}
        <GlassEnvironment />
        <directionalLight position={[3, 5, 6]} intensity={1.2} />
        <ambientLight intensity={0.4} />
        {FOOTER_GLASS.glassReveal && <RevealRig revealRef={revealRef} />}
        <RenderPump onReady={onReady} />
        <ContextWatchdog onUnrecoverable={remount} />
      </Suspense>
    </Canvas>
  );
}

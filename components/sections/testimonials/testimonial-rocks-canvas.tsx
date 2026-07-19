"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrthographicCamera, useCursor, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { GROUP_H, GROUP_W, REVEAL, UNITS } from "./testimonials-data";
import {
  isTestimonialsRevealPlayed,
  onTestimonialsRevealPlay,
  onTestimonialsRevealReset,
} from "./testimonials-reveal";
import { requestQuoteAdvance } from "./testimonials-quote-advance";
import {
  useSharedView,
  type SharedViewControls,
} from "@/components/canvas/use-shared-view";
import type { FpsCap } from "@/components/canvas/view-registry";
import { TESTIMONIAL_ROCKS_INDEX } from "@/components/canvas/indices";

// AgX slightly darkens; this exposure lifts it back (the old canvas set it at
// context creation). Shared by the per-view setter AND the warm precompile —
// they must agree or the warm compiles the wrong program variant.
const ROCKS_EXPOSURE = 1.15;

// Steady-state paint cap (retuned 2026-07-19): the orbit/tumble is slow enough
// that 30 reads identical to the old heavy-60, and it halves the paints that
// were colliding with the testimonials section-cloud's morph ticks (every
// 30fps cloud paint landed on a 60fps rock tick — the coinciding GPU work was
// the section's dropped-frame source; measured 80→119.7 rAF with this + the
// cloud retune). Hover uncaps to "heavy" so the dodge spring stays glassy.
const ROCKS_STEADY_FPS = 30;

// Rock-level hover → view-level fpsCap bridge. The hover lives per <Rock> deep
// in the scene; the cap lives on the view registration. Module-scope counter +
// useSyncExternalStore (same idiom as the reveal events file).
const rockHover = {
  count: 0,
  listeners: new Set<() => void>(),
  set(on: boolean) {
    this.count += on ? 1 : -1;
    for (const l of this.listeners) l();
  },
  subscribe(l: () => void) {
    rockHover.listeners.add(l);
    return () => rockHover.listeners.delete(l);
  },
  any: () => rockHover.count > 0,
};

/**
 * The four testimonials rocks as REAL 3D meshes — the "floating 3D rock" the
 * flat sprite couldn't give. Each rock tumbles on its own axes and orbits its
 * ring centre. The rings + dots stay as DOM (testimonials.tsx); the rocks render
 * BEHIND them (the MID plane, z 0) and behind the z-10 pull-quote, so a rock
 * that overflows its ring passes UNDER the white hoop exactly as in the Figma.
 *
 * The rocks are HOVER-INTERACTIVE: pointer over a rock (raycast against the
 * mesh) makes it dodge away from the cursor with a slight grow, and advances
 * the pull-quote to the next testimonial (requestQuoteAdvance →
 * testimonials-quote-reveal.tsx). See the HOVER_* constants + Rock below.
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
 *  - IBL: a procedural sky-gradient environment (buildSkyEnvMap) — the main
 *    lever; PBR needs surroundings to reflect or it looks lit-in-a-void.
 *  - Lights: low ambient + a shaping key (flat ambient was the "clay" tell),
 *    hemisphere/rim keep undersides off near-black — kept light for the Figma.
 *  - AgX tone mapping (was NoToneMapping/`flat`) for photographic highlights —
 *    now set per-view by the shared host (toneMapping + exposure on useSharedView).
 *  - Material: metalness 0.2, roughness 0.25 (a glossy wet-stone sheen off the
 *    IBL; was chalky 1.0), normalScale 1.4, envMapIntensity 0.6. (Metalness
 *    forced — glTF's absent factor defaults 1.)
 *
 * Placement: an ORTHOGRAPHIC per-view camera maps 1 world unit → 1 px, so each
 * rock sits at its exact group-px centre and its `size` reads as px on screen —
 * no perspective drift to fight. The 3D read comes from the mesh + lights +
 * tumble, which is plenty at this scale.
 *
 * RENDERING HOST (Phase 3, docs/canvas-consolidation-plan.md): this no longer
 * owns a Canvas element. It registers ONE view on the shared MID plane
 * (components/canvas/, z 0) via useSharedView, passing the rock scene as that
 * view's `children`. The host wraps it in a drei <View> scissored to the `track`
 * placeholder (the in-flow 120vw/120vh wrapper, which scrolls with the section),
 * sets this view's AgX tone mapping + exposure at priority index-1, and paints it
 * from the single ticker-end advance pump — NO private frameloop, no gsap.ticker,
 * no explicit paint call. Paint cadence is expressed through the registration (mode/fpsCap)
 * + markDirty/requestBurst; see the paint-policy block in the default export.
 *
 * Heavy-effect contract (CLAUDE.md), now delegated to the host:
 * - The host pump is the sole paint driver (frameloop="never"); this view is
 *   registered continuous "heavy" while the section is on screen / mid-reveal, so
 *   it paints ≤60/s, and demand otherwise. The host IntersectionObserver on the
 *   track idles it to zero off-screen.
 * - dpr ≤1.5 is the plane's ceiling. Tier gating + the no-WebGL/reduced-motion/
 *   mobile fallback live in the wrapper (testimonial-rocks.tsx).
 * - WARMED AHEAD: the wrapper idle-mounts this view (after idle-preloading the
 *   GLB) long before the section is on screen, so useGLTF resolves from cache;
 *   Scene's gl.compileAsync warms the shader/PMREM off-screen on a calm main
 *   thread, and a mount requestBurst(1) paints the (opacity-0) warm frame the
 *   instant the track first becomes visible. Then zero frames until the reveal.
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

// Hover nudge — pointer over a rock grows it slightly AND pushes it away from
// the cursor (a shy dodge: the push direction is cursor-hit → rock centre,
// re-aimed on every pointer move, so the rock keeps leaning away as you chase
// it), and fires the next testimonial (requestQuoteAdvance →
// testimonials-quote-reveal.tsx). k (grow) and the push offset are GSAP-tweened
// values read by the render frame, so the nudge composes with the orbit +
// fly-in offsets without touching them. The push is deliberately small vs the
// rock (~7% of its size): the cursor stays inside the silhouette, so the dodge
// can't push the rock out from under the pointer and jitter over/out.
const HOVER_GROW = 0.06; // scale multiplier at full hover
const HOVER_PUSH = 0.16; // dodge distance as a fraction of the rock's size
const HOVER_IN = { k: 1, duration: 0.45, ease: "back.out(2.5)" } as const;
const HOVER_OUT = { k: 0, duration: 0.6, ease: "power2.out" } as const;
// GLIDE, not push — a critically-damped spring integrated each frame by the
// render loop. A re-targeted tween CANNOT glide here: it restarts its ease on
// every pointer-move, so with any gentle (slow-start) ease the rock stayed
// pinned in the first frames of the curve and the dodge read as unnoticeable.
// The spring carries velocity across re-aims — it drifts into motion, tracks
// the cursor continuously, and settles with no stop-start.
const PUSH_SPRING = 40; // stiffness — ~0.5s response
const PUSH_DAMP = 2 * Math.sqrt(PUSH_SPRING); // critical damping — no overshoot

/**
 * A procedural sky-gradient environment map (image-based lighting) — no network
 * asset. Prefiltered through PMREM so the rough rock reads it as soft ambient
 * sky colour + a faint sheen, which is what grounds the rocks IN the scene
 * instead of looking lit-in-a-void. The gradient echoes the page sky, and it's
 * attached to the MATERIAL (not scene.environment) so nothing mutates a hook
 * value and the one-time bake doesn't depend on the (never) render loop. Baked
 * from the SHARED plane renderer (useThree gl inside the view children).
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
    // Start invisible + (via Rock) off-screen: each PLAY snaps the shared
    // material visible (opacity → 1, Scene) and eases the rocks in from beyond
    // the viewport; each RESET re-hides it. transparent stays on (depthWrite is
    // still true, so faces occlude normally — no ghosting); the 4 rocks don't
    // overlap, so blend cost is nil. If the reveal already played (context-loss
    // plane remount mid-view), build it visible — the rocks reappear at rest.
    material.transparent = true;
    material.opacity = isTestimonialsRevealPlayed() ? 1 : 0;
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
}: {
  unit: (typeof UNITS)[number];
  motion: Motion;
  index: number;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}) {
  const orbit = useRef<THREE.Group>(null);
  const tumble = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const baseX = unit.cx - GROUP_W / 2;
  const baseY = -(unit.cy - GROUP_H / 2);

  // Hover: raycast pointer events on the mesh itself (pixel-true against the
  // rock's geometry — no DOM hotspot to drift from the tumbling silhouette).
  // Entering triggers the next testimonial and springs the nudge in; leaving
  // eases it back. useCursor flips the page cursor to a pointer while over.
  const hover = useRef({ k: 0 });
  const hoverTween = useRef<gsap.core.Tween | undefined>(undefined);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const setHover = useCallback((on: boolean) => {
    setHovered(on);
    rockHover.set(on); // lifts the view's cap to "heavy" while any rock is hot
    hoverTween.current?.kill();
    hoverTween.current = gsap.to(hover.current, on ? HOVER_IN : HOVER_OUT);
    if (on) requestQuoteAdvance();
  }, []);

  // The dodge state: pos (px, world space) is what the frame applies; target is
  // where dodge() last aimed it (away from the cursor, zero on pointer-out);
  // vel makes it a spring — pos chases target with continuous velocity, so
  // re-aiming on every pointer move stays glassy-smooth.
  const push = useRef({
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    target: { x: 0, y: 0 },
  });
  const dodge = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      // Away = from the cursor's hit point on the rock, through its centre.
      const c = orbit.current?.position;
      if (!c) return;
      let dx = c.x - e.point.x;
      let dy = c.y - e.point.y;
      const len = Math.hypot(dx, dy);
      // Dead-centre hit has no direction — dodge upward.
      if (len < 1) {
        dx = 0;
        dy = 1;
      } else {
        dx /= len;
        dy /= len;
      }
      const mag = unit.size * HOVER_PUSH;
      push.current.target.x = dx * mag;
      push.current.target.y = dy * mag;
    },
    [unit.size],
  );
  useEffect(
    () => () => {
      hoverTween.current?.kill();
    },
    [],
  );

  // Fly-in offset (px), added to the orbit position by the render frame.
  // Parked at base × (flyFactor − 1) — so the rock sits at base × flyFactor,
  // well outside the viewport, along its own outward radial (the four thus
  // arrive from four directions) — and each PLAY eases it to 0, landing on the
  // ring; each RESET re-parks it so the entrance replays on the next pass. If
  // the reveal already played (context-loss plane remount mid-view), start at
  // rest — the rock reappears in place, it doesn't re-fly.
  const parkedX = baseX * (REVEAL.flyFactor - 1);
  const parkedY = baseY * (REVEAL.flyFactor - 1);
  const offset = useRef(
    isTestimonialsRevealPlayed()
      ? { x: 0, y: 0 }
      : { x: parkedX, y: parkedY },
  );

  // The float: a slow orbit + 3D tumble about the base, plus the fly-in offset,
  // plus the hover nudge (dodge spring + grow). Formerly a manual updater called
  // by a private gsap.ticker pump; now a useFrame that runs on each host advance.
  // The clock it reads is the plane pump's virtual clock (monotonic seconds,
  // delta-clamped by the host) — the updaters only ever needed monotonic seconds
  // (orbit/tumble absolute phase, dodge-spring delta), so this is a clean swap.
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime; // host virtual clock, seconds
    // Integrate the dodge spring. dt is clamped so a pump gap (section was
    // off-screen, tab hidden) can't make one giant unstable step on resume; the
    // host already clamps its virtual delta, and this belt-and-suspenders 0.05
    // ceiling matches the standalone.
    const dt = Math.min(delta, 0.05);
    const p = push.current;
    p.vel.x += ((p.target.x - p.pos.x) * PUSH_SPRING - p.vel.x * PUSH_DAMP) * dt;
    p.vel.y += ((p.target.y - p.pos.y) * PUSH_SPRING - p.vel.y * PUSH_DAMP) * dt;
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;

    const a = motion.orbitPhase + t * (TAU / motion.orbitDur) * motion.orbitDir;
    orbit.current?.position.set(
      baseX + Math.cos(a) * motion.orbitR + offset.current.x + p.pos.x,
      baseY + Math.sin(a) * motion.orbitR + offset.current.y + p.pos.y,
      0,
    );
    tumble.current?.rotation.set(
      motion.phase[0] + t * motion.spin[0],
      motion.phase[1] + t * motion.spin[1],
      motion.phase[2] + t * motion.spin[2],
    );
    mesh.current?.scale.setScalar((unit.size / 2) * (1 + hover.current.k * HOVER_GROW));
  });

  // PLAY: re-park off-screen, then ease the offset → 0 (the fly-in). The host
  // pump (painting whenever the section is visible) renders every frame of it.
  // RESET (section fully left): kill any live tween and re-park, ready for the
  // next pass. Replays every time the section is passed through.
  useEffect(() => {
    let tween: gsap.core.Tween | undefined;
    const unPlay = onTestimonialsRevealPlay(() => {
      tween?.kill();
      offset.current.x = parkedX;
      offset.current.y = parkedY;
      tween = gsap.to(offset.current, {
        x: 0,
        y: 0,
        duration: REVEAL.flyDur,
        delay: REVEAL.flyDelay(index),
        ease: REVEAL.flyEase,
      });
    });
    const unReset = onTestimonialsRevealReset(() => {
      tween?.kill();
      offset.current.x = parkedX;
      offset.current.y = parkedY;
    });
    return () => {
      unPlay();
      unReset();
      tween?.kill();
    };
  }, [index, parkedX, parkedY]);

  return (
    <group ref={orbit} position={[baseX, baseY, 0]}>
      <group ref={tumble} rotation={[motion.phase[0], motion.phase[1], motion.phase[2]]}>
        <mesh
          ref={mesh}
          geometry={geometry}
          material={material}
          scale={unit.size / 2}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
            dodge(e);
          }}
          onPointerMove={dodge}
          onPointerOut={() => {
            setHover(false);
            push.current.target.x = 0;
            push.current.target.y = 0;
          }}
        />
      </group>
    </group>
  );
}

/**
 * The rock scene = the view's r3f children (the host wraps this in a drei <View>
 * + per-view tone-mapping setter + Suspense). A per-view ORTHOGRAPHIC camera
 * (makeDefault) gives 1 world unit = 1 px against the track rect — drei's <View>
 * forces its frustum to the (120vw/120vh) track each frame, so the mapping the
 * standalone orthographic canvas relied on is preserved with no code change.
 */
function Scene() {
  const asset = useRockAsset(); // suspends on useGLTF; host Suspense catches it
  // Store getter for the warm effect below — values fetched inside the effect
  // (not hook returns), which is also what lets it mutate gl.toneMapping
  // without tripping react-hooks/immutability.
  const get = useThree((s) => s.get);

  // WARM the pipeline off-screen: compile the shader program NOW (idle mount,
  // calm main thread) so the reveal later is pure animation. Under the host the
  // old "single warm paint" cannot fire off-screen (the pump only paints
  // VISIBLE views), so compileAsync — which needs no paint — carries the warm;
  // the mount requestBurst(1) (default export) covers the geometry/texture upload
  // on the first visible frame, invisibly (material opacity 0). KHR_parallel_
  // shader_compile overlaps the download where available.
  useEffect(() => {
    if (!asset) return;
    // Compile under THIS view's tone mapping. toneMapping is part of three's
    // program cache key, and the per-view AgX setter only runs during pump
    // paints — at idle mount the renderer still holds R3F's default ACES, so a
    // bare compileAsync would warm the WRONG variant and the first visible
    // paint would recompile AgX in-band (the exact hitch this warm exists to
    // kill). Set AgX for the compile, restore after.
    const { gl: renderer, scene, camera } = get();
    const prevTone = renderer.toneMapping;
    const prevExp = renderer.toneMappingExposure;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = ROCKS_EXPOSURE;
    renderer
      .compileAsync(scene, camera)
      .catch(() => {
        /* a failed precompile just means the shader compiles in-band on entry */
      })
      .finally(() => {
        renderer.toneMapping = prevTone;
        renderer.toneMappingExposure = prevExp;
      });
  }, [asset, get]);

  // Reveal fade on the shared material (all four rocks at once). The rocks are
  // off-screen at the PLAY instant, so this quick fade is essentially unseen — it
  // only softens the edge as each rock crosses into view. The per-rock fly-in
  // lives in Rock; the rings draw in after (testimonials-drift.tsx). RESET parks
  // it invisible for the next pass.
  useEffect(() => {
    if (!asset) return;
    const mat = asset.material;
    let fade: gsap.core.Tween | undefined;
    const unPlay = onTestimonialsRevealPlay(() => {
      fade?.kill();
      fade = gsap.to(mat, { opacity: 1, duration: 0.3, ease: "none" });
    });
    const unReset = onTestimonialsRevealReset(() => {
      fade?.kill();
      mat.opacity = 0;
    });
    return () => {
      unPlay();
      unReset();
      fade?.kill();
    };
  }, [asset]);

  if (!asset) return null;

  return (
    <>
      {/* 1 world unit = 1 px: drei <View>.prepareSkissor forces this ortho
          camera's frustum to the track rect each frame (it isn't `manual`), and
          the track is the 120vw/120vh viewport-centred wrapper, so world origin =
          viewport centre — exactly the standalone canvas's mapping. */}
      <OrthographicCamera
        makeDefault
        position={[0, 0, 100]}
        zoom={1}
        near={0.1}
        far={1000}
      />
      {/* With the sky IBL (buildSkyEnvMap) now carrying the fill, ambient is low
          again so the form reads (flat ambient was the "clay" tell); the key does
          the shaping and the hemisphere + rim keep the undersides from the old
          near-black. Kept light overall to match the Figma. */}
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
        />
      ))}
    </>
  );
}

/**
 * Registers the rock scene as ONE view on the shared MID plane. Renders nothing
 * in the DOM — the placeholder/track (the 120vw/120vh wrapper) is the caller's
 * own (testimonial-rocks.tsx); the host's fixed plane Canvas scissors this view to
 * the track's live rect.
 *
 * PAINT POLICY (mirrors the intro's descriptor-flip): continuous "heavy" while
 * the section is on screen (`inView`) OR the fly-in is running (`revealing`) —
 * the host pump paces it to ≤60/s and idles it to zero via the track
 * IntersectionObserver when off-screen. Demand otherwise.
 *
 * ⚠️ The reveal fires SYNCHRONOUSLY inside a scroll ScrollTrigger callback (mid-
 * scroll). Flipping `revealing` is a React state change → a DEFERRED effect →
 * the descriptor would only go continuous once the scroll pauses (the historic
 * "rocks only appear on scroll-stop" bug). So the PLAY handler also markDirty()s
 * + requestBurst(1)s SYNCHRONOUSLY: those mutate the registry entry in place, so
 * the host pump (running later in the SAME ticker tick) paints this tick — in
 * lockstep with the rings — while the state-driven mode flip takes over next tick.
 */
export default function TestimonialRocksView({
  track,
  inView,
}: {
  track: RefObject<HTMLElement | null>;
  inView: boolean;
}) {
  // Stable paint-control wrappers. useSharedView RETURNS the controls, but the
  // scene `children` are an ARGUMENT to that same call, so the reveal handler
  // (which fires before the hook's controls object is even assigned on first
  // render) routes through a ref pointed at the stable controls right after.
  const controlsRef = useRef<SharedViewControls | null>(null);
  const markDirty = useCallback(() => controlsRef.current?.markDirty(), []);
  const requestBurst = useCallback(
    (n: number) => controlsRef.current?.requestBurst(n),
    [],
  );

  // Reveal keepalive + synchronous paint start. `revealing` keeps the view
  // continuous through the fly-in even if `inView` toggles under a fast scroll;
  // it clears once the last rock has landed (+ slack).
  const [revealing, setRevealing] = useState(false);
  useEffect(() => {
    let done: gsap.core.Tween | undefined;
    const revealTotal = REVEAL.flyDelay(UNITS.length - 1) + REVEAL.flyDur + 0.4;
    const unPlay = onTestimonialsRevealPlay(() => {
      setRevealing(true);
      // Synchronous — start advancing THIS tick, mid-scroll, before the state
      // flip commits (see the ⚠️ note above). The burst spans the WHOLE fly-in
      // (~60/s worth), so even if the React commit that flips the descriptor
      // to continuous lags under load, the fly-in never stutters — the burst
      // alone carries it, and it's consumed/superseded once continuous lands.
      markDirty();
      requestBurst(Math.ceil(revealTotal * 60));
      done?.kill();
      done = gsap.delayedCall(revealTotal, () => setRevealing(false));
    });
    const unReset = onTestimonialsRevealReset(() => {
      done?.kill();
      setRevealing(false);
    });
    return () => {
      unPlay();
      unReset();
      done?.kill();
    };
  }, [markDirty, requestBurst]);

  const active = inView || revealing;
  const mode = active ? "continuous" : "demand";
  // Dev A/B hook (2026-07-19 morph-cost tuning): ?rocksfps=N overrides the
  // steady cap so the rocks-vs-cloud paint interplay can be measured live.
  const devFps = useMemo(() => {
    if (typeof window === "undefined") return null;
    const n = Number(new URLSearchParams(window.location.search).get("rocksfps"));
    return n > 0 ? Math.min(n, 60) : null;
  }, []);
  // Steady 30 (ROCKS_STEADY_FPS — the slow orbit reads the same and stops
  // colliding with the section-cloud morph ticks); "heavy" (≤60) while any rock
  // is hovered so the dodge spring rides the fast cadence. The reveal fly-in
  // also runs at "heavy" (revealing) so the entrance stays crisp.
  const anyHovered = useSyncExternalStore(rockHover.subscribe, rockHover.any, () => false);
  const fpsCap: FpsCap =
    devFps ?? (anyHovered || revealing ? "heavy" : ROCKS_STEADY_FPS);

  const children: ReactNode = useMemo(() => <Scene />, []);

  const controls = useSharedView({
    plane: "mid",
    index: TESTIMONIAL_ROCKS_INDEX,
    track,
    // AgX gives a photographic highlight roll-off (replaces the flat/clipped
    // NoToneMapping "digital" look); exposure lifts AgX's slight darkening. The
    // host sets both for this view at priority index-1 (replaces onCreated).
    toneMapping: THREE.AgXToneMapping,
    toneMappingExposure: ROCKS_EXPOSURE,
    mode,
    fpsCap,
    children,
  });
  // Point the wrapper ref at the (stable) controls in the commit's LAYOUT phase —
  // before any child passive effect, so the reveal handler is never a null no-op.
  useLayoutEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  // Warm frame: paint the (opacity-0) scene the instant the track first becomes
  // visible, so geometry/texture upload happens before the reveal (Scene's
  // compileAsync warms the programs off-screen). Declared AFTER useSharedView so
  // it runs after the registration effect — fired earlier it would hit an empty
  // registry and no-op (the host's canvas-mount burstAll masked that, but only
  // for the very first mount).
  useEffect(() => {
    requestBurst(1);
  }, [requestBurst]);

  return null;
}

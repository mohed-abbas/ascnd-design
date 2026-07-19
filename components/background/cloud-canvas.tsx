"use client";

import { useThree } from "@react-three/fiber";
import { Cloud, Clouds, PerspectiveCamera } from "@react-three/drei";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import * as THREE from "three";
import type { Group } from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { CloudSpec } from "./cloud-specs";
import { getQualityConfig } from "@/lib/perf/quality-store";
import { useMode } from "@/lib/theme/use-mode";
import { getMode } from "@/lib/theme/mode-store";
import { CROSSFADE, PALETTES } from "@/lib/theme/palette";
import {
  introWillPlay,
  INTRO_REVEAL_EVENT,
  INTRO_START_EVENT,
} from "@/components/sections/intro/intro-state";
import {
  useSharedView,
  type SharedViewControls,
} from "@/components/canvas/use-shared-view";
import {
  setPlaneDprOverride,
  type PlaneName,
} from "@/components/canvas/view-registry";

/**
 * Volumetric cloud field (Three.js / R3F + drei <Clouds>).
 *
 * This is the /lab/clouds reference cloud ported into the global background:
 * lit drei <Cloud>s on a <MeshLambertMaterial>, framed from a 3/4 above-front
 * camera. Lighting is a white directional key + ambient (PALETTES[mode].cloud) —
 * chosen over the lab's positioned spotlights so every cloud is lit identically
 * wherever it's placed (uniformly white, no position tint) and so theme modes
 * (evening/night) drop in as light-colour swaps. The look was tuned in
 * /lab/clouds and baked below (no leva here). Each hero cloud is anchored to a
 * screen spot via NDC (top-right corner + the two rock bases) by <CloudPlacement>.
 *
 * RENDERING HOST (Phase 4, docs/canvas-consolidation-plan.md): this file no longer
 * owns a <Canvas>. `CloudView` (default export) registers ONE view on a shared
 * plane via useSharedView, passing the cloud scene as that view's `children`.
 * cloud-layer.tsx instantiates it TWICE — SKY_CLOUDS on the REAR plane
 * (components/canvas/, z -10, behind content) and ROCK_CLOUDS on the FRONT plane
 * (z 61, over the cliffs). The host wraps each in a drei <View> scissored to its
 * fixed inset-0 `track` div, sets ACESFilmicToneMapping for the view at priority
 * index-1, and paints it from the single ticker-end advance pump — NO private
 * frameloop, no invalidate(), no gsap.ticker.add here.
 *
 * Paint policy (see the default export). The clouds' fixed inset-0 placeholder
 * ALWAYS intersects the viewport, so the host IntersectionObserver can't idle
 * them — visibility gating is feature-side (`onScreen`, from the field pumpUntilVh
 * gate + the section activeClouds set). While on screen the view is CONTINUOUS at
 * 30 fps (the slow living billow; morph advances only on a paint, so 30 fps of
 * paints = the old MorphRig cadence with no private ticker). While SCROLLING it
 * flips to fpsCap "scroll" (uncapped on high) so the field rides the display —
 * this is the weld: ROCK_CLOUDS track the cliff feet with no half-rate stagger.
 * Off screen it idles to DEMAND (nothing dirties it → zero paints).
 *
 * Look constants preserved from the standalone canvas:
 * - Self-hosted sprite texture (/textures/cloud-puff.png) — a LOCAL COPY of drei's
 *   detailed cloud sprite (never hits the CDN at runtime; reliability/offline/
 *   privacy mandate, docs/cloud-rendering-research.md §9). It must be a detailed
 *   painted puff: the old /textures/cloud.png was a featureless radial blob.
 * - frustumCulled={false} on <Clouds>: the internal InstancedMesh has a stale
 *   bounding sphere under parallax, which would cull the whole batch and make the
 *   cloud vanish on scroll. One batched mesh, so always-drawing is cheap.
 * - Tone mapping is ACESFilmic (R3F's default; declared on the descriptor so the
 *   per-view setter restores it before the cloud renders — on FRONT it alternates
 *   with the intro's NoToneMapping). The bright key light carries the white.
 * - dpr is a PLANE-level ceiling now ([1, cloudDprMax] live in plane-canvas.tsx),
 *   NOT set here; only `cloudSegments` stays a per-feature mount snapshot below.
 *
 * Context-loss resilience is the host's ContextWatchdog (one per plane); the
 * clouds' own watchdog + canvas-remount key are gone.
 */

// Shared cloud look (tuned in /lab/clouds; the dev leva panel is gone). Size,
// seed and placement are per-cloud in the specs. `speed` is small + non-zero so
// the puffs slowly morph (lively, not churning); the CONTINUOUS-30 paint policy
// (default export) advances that morph at ~30 fps. `segments` (the fill-rate
// knob) is tiered — see cloudSegments in lib/perf/tiers.ts, snapshotted at mount.
// Master switch for the living billow. false = fully STATIC cloud shapes:
// drei scales BOTH the morph phase (sin(t·density·speed)) and each segment's
// rotationFactor by `speed` (node_modules/@react-three/drei/core/Cloud.js:185),
// so speed 0 freezes shape and rotation alike — the site's original static
// look. The paint policy below follows it: with the morph off the view never
// runs continuous, so still clouds cost ZERO paints (scroll/theme/reveal
// repaints still work via markDirty — weld, parallax and retint unaffected).
// Flip to true to bring the billow back at MORPH_FPS.
const MORPH_CLOUDS = false;

// (speed lives on the <Cloud> prop, derived from the toggle + ?morphfps hook
// inside CloudView — see cloudSpeed there.)
const CLOUD = {
  opacity: 0.8,
  fade: 10,
  growth: 2,
  color: "white",
} as const;
// Max cloud SEGMENTS rendered per <Clouds> batch. drei draws
// count = min(limit, range, totalSegments) sprites, where each <Cloud> expands
// into `segments` billboards (cloudSegments: 20 on the high tier). So this is a
// hard ceiling on the CLOUD COUNT: range/segments = 400/20 = 20 high-tier clouds
// per canvas. Kept equal to `limit` below so the buffer, not this, is the ceiling.
const RANGE = 400;

// Cloud placements (NDC/dist/size) live in cloud-specs.ts — see CloudSpec.

// Baked camera — a 3/4 above-front view; the angle plus the sprite's own painted
// shading is what makes the billboards read as dimensional. Rendered as a
// per-view <PerspectiveCamera makeDefault> so the shared host's neutral camera is
// untouched; <CameraRig> aims it at the origin (the old onCreated lookAt).
const CAMERA = { position: [0, 11, 18] as [number, number, number], fov: 50 };

// Cloud lighting is position-INDEPENDENT (only ambient + directional, no spot
// lights) so a cloud is lit identically wherever it sits — which is exactly what
// makes theming a clean colour swap. The per-mode ambient/key colours+intensities
// live in lib/theme/palette.ts (PALETTES[mode].cloud); <ThemeRig> tweens the two
// lights when the mode changes, in lockstep with the DOM sky (same CROSSFADE).
// The key light's DIRECTION is mode-invariant, so it stays here.
const KEY_LIGHT_POSITION = [0, 20, 12] as [number, number, number];

// Flip to false to REVERT to always-white clouds (day lighting in every mode).
const RETINT_CLOUDS = true;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// Reference depth (world units along the camera ray) for the scroll math. The
// hero clouds all sit here, so the scroll→world conversion below is exact for
// them. Clouds at other depths get a subtle parallax, which is fine.
const REF_DIST = 22;

// Scroll parallax damping (a prop): 1 = welded to the page (rock-base clouds MUST
// stay 1.0 — glued to the cliff feet, which scroll 1:1); < 1 = slower, calmer
// background drift. cloud-layer.tsx sets each layer's value.
const DEFAULT_SCROLL_FACTOR = 1;

// Billow cadence WHEN MORPH_CLOUDS IS ON — dormant while the morph is off.
// Perf reference (measured 2026-07-19 on the drop-prone dev profile): 30 was
// the original MorphRig cadence and dropped sections to ~97-110 rAF; 20 read
// visually identical and recovered most of it. Values above 20 spend frame
// budget fast — at 120 every tick is a full-plane cloud repaint.
const MORPH_FPS = 20;

// How long after the last scroll update to treat the field as "scrolling" — the
// window over which the view holds fpsCap "scroll" (display rate) so the weld
// doesn't stagger, before dropping back to the 30 fps morph cadence.
const SCROLL_IDLE_S = 0.15;

// Reveal fade/drift (mirrors the old CSS wrapper reveal, now in-scene because the
// clouds render on the shared plane, not inside the DOM wrapper): ~matches the
// rocks' 1.1s drift so they settle together, from 14px up + transparent.
const REVEAL_DUR = 1.1;
const REVEAL_DRIFT_PX = 14;

/** NDC (z=0.5) → world point walked `dist` along the camera ray. */
function placeOnRay(
  camera: THREE.Camera,
  ndcX: number,
  ndcY: number,
  dist: number,
  out: THREE.Vector3,
) {
  out.set(ndcX, ndcY, 0.5).unproject(camera);
  out.sub(camera.position).normalize().multiplyScalar(dist).add(camera.position);
  return out;
}

const _vTop = new THREE.Vector3();
const _vBot = new THREE.Vector3();
/**
 * World-Y span of the full viewport at REF_DIST — the conversion factor between
 * scroll pixels and cloud world translation. One viewport of scroll moves the
 * field by exactly this much, so a cloud at REF_DIST tracks the page 1:1.
 * Aspect-independent (unprojects NDC x=0), so it's stable under the per-view
 * <View> camera whose horizontal aspect drei forces to the track rect each frame.
 */
function viewportWorldHeight(camera: THREE.Camera) {
  placeOnRay(camera, 0, 1, REF_DIST, _vTop);
  placeOnRay(camera, 0, -1, REF_DIST, _vBot);
  return _vTop.y - _vBot.y;
}

/**
 * Full world-space length of the viewport's vertical edge at REF_DIST — the
 * scroll→world factor for FLAT (perspective-off) clouds. Both edge points sit
 * exactly REF_DIST from the camera, so translating a cloud along the camera-up
 * axis between them moves it up the screen at CONSTANT distance-to-camera.
 */
function viewportUpSpan(camera: THREE.Camera) {
  placeOnRay(camera, 0, 1, REF_DIST, _vTop);
  placeOnRay(camera, 0, -1, REF_DIST, _vBot);
  return _vTop.distanceTo(_vBot);
}

/**
 * The camera's up-axis in world space (matrixWorld column 1). This is the FLAT
 * scroll axis: perpendicular to the view direction, so travelling along it is
 * pure screen-vertical motion with no depth (size) change.
 */
function cameraUp(camera: THREE.Camera) {
  return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
}

/** The shared cloud material the drei <Clouds> instances — traversed for the
 *  reveal fade (diffuseColor.a * vOpacity, so material.opacity scales all). */
function findCloudMaterial(root: THREE.Object3D | null): THREE.Material | null {
  if (!root) return null;
  let mat: THREE.Material | null = null;
  root.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (!mat && m.isInstancedMesh && m.material)
      mat = m.material as THREE.Material;
  });
  return mat;
}

/**
 * Per-view perspective camera. drei's <View> renders each portal with its
 * portal-scoped default camera; <PerspectiveCamera makeDefault> swaps THAT one
 * (not the host's root camera). <CameraRig> then aims it at the origin — the old
 * onCreated lookAt — and sets its aspect from the (full-viewport) track size so
 * the placement math is exact before the rigs' passive effects read it (View
 * re-forces the same aspect each frame). Layout effect → runs before the rigs.
 */
function CameraRig() {
  const get = useThree((s) => s.get);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  useLayoutEffect(() => {
    const { camera } = get();
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.isPerspectiveCamera && height > 0) persp.aspect = width / height;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [get, width, height]);
  return null;
}

/**
 * Anchors each cloud to its target screen position. For each CloudSpec it
 * unprojects the NDC through the camera to a ray, walks `dist` down that ray, and
 * writes the world point to the cloud's group. `anchorVh` then pushes it down the
 * world by that many viewports, so section-N clouds start off-screen-below and
 * <ScrollAnchorRig> lifts them into view at the right scroll. Recomputes on
 * resize; markDirty()s the demand view to repaint the new layout.
 */
function CloudPlacement({
  clouds,
  cloudRefs,
  scrollFactor,
  perspective,
  markDirty,
}: {
  clouds: CloudSpec[];
  cloudRefs: RefObject<(Group | null)[]>;
  scrollFactor: number;
  /** Match the cloud's <ScrollAnchorRig>: offset the anchorVh baseline along
   *  world-Y (true) or the camera-up axis (false). */
  perspective: boolean;
  markDirty: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useEffect(() => {
    const vwh = viewportWorldHeight(camera);
    const upSpan = viewportUpSpan(camera);
    const camUp = cameraUp(camera);
    const v = new THREE.Vector3();
    clouds.forEach((c, i) => {
      const g = cloudRefs.current[i];
      if (!g) return;
      placeOnRay(camera, c.ndc[0], c.ndc[1], c.dist, v);
      const anchor = (c.anchorVh ?? 0) * scrollFactor;
      if (perspective) {
        g.position.set(v.x, v.y - anchor * vwh, v.z);
      } else {
        const off = anchor * upSpan;
        g.position.set(v.x - camUp.x * off, v.y - camUp.y * off, v.z - camUp.z * off);
      }
    });
    markDirty();
  }, [clouds, camera, width, height, cloudRefs, scrollFactor, perspective, markDirty]);

  return null;
}

/**
 * Scroll anchoring (approach C): translate the whole cloud field UP in world
 * space as the page scrolls, so clouds move with the document instead of being
 * pinned to the viewport. The conversion (scroll px → world units) is calibrated
 * to REF_DIST, then damped by scrollFactor. Each section's clouds (anchorVh) rise
 * into frame as you reach them.
 *
 * HOST: the position is written on EVERY scroll update (so a re-entry is already
 * correct), but the paint is markDirty()'d only while some cloud is on screen
 * (onScreenRef) — off screen the demand view idles to zero. The view's fpsCap
 * "scroll" (uncapped on high) is what lets the field ride the display, so no
 * per-rig capping (the old makeCappedInvalidate) is needed.
 */
function ScrollAnchorRig({
  groupRef,
  scrollFactor,
  perspective,
  markDirty,
  onScreenRef,
}: {
  groupRef: RefObject<Group | null>;
  scrollFactor: number;
  perspective: boolean;
  markDirty: () => void;
  onScreenRef: RefObject<boolean>;
}) {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const worldPerPx =
      (perspective ? viewportWorldHeight(camera) : viewportUpSpan(camera)) /
      window.innerHeight;
    const camUp = perspective ? null : cameraUp(camera);

    const apply = (scroll: number, paint: boolean) => {
      const g = groupRef.current;
      if (!g) return;
      const d = scroll * worldPerPx * scrollFactor;
      if (perspective) {
        g.position.set(0, d, 0);
      } else {
        g.position.set(camUp!.x * d, camUp!.y * d, camUp!.z * d);
      }
      if (paint) markDirty();
    };

    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      scrub: true,
      onUpdate: (self) => apply(self.scroll(), onScreenRef.current),
    });

    // Seed the position for a load that restores mid-page (scrub fires lazily).
    apply(window.scrollY || 0, onScreenRef.current);

    // Re-seed after every refresh. ScrollTrigger.refresh() reverts the scroller
    // to 0 to measure, snapping this field back to its hero anchor; re-applying
    // the true scroll (st.scroll(), robust to Lenis reading 0 for a tick) once the
    // refresh restores overwrites that stale frame. Paint unconditionally so an
    // on-screen field corrects immediately.
    const onRefresh = () => apply(st.scroll(), true);
    ScrollTrigger.addEventListener("refresh", onRefresh);

    return () => {
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      st.kill();
    };
  }, [groupRef, camera, width, height, scrollFactor, perspective, markDirty, onScreenRef]);

  return null;
}

/**
 * Section-anchored clouds — driven by their OWN section's scroll crossing (a
 * scrubbed ScrollTrigger on the section element) rather than an absolute
 * `anchorVh`, so they need no viewport-height counting and are robust to sections
 * being reordered above them. Motion is Option B (constant-velocity drift through
 * the `ndc` rest spot). It also reports each cloud's on-screen state into the
 * shared activeClouds set (so the registration module keeps `onScreen` true while
 * a section cloud is visible) via onActiveChange.
 */
function SectionRig({
  clouds,
  cloudRefs,
  activeClouds,
  markDirty,
  onScreenRef,
  onActiveChange,
}: {
  clouds: CloudSpec[];
  cloudRefs: RefObject<(Group | null)[]>;
  /** Which section clouds are on screen right now (read by the reg. module). */
  activeClouds: RefObject<Set<string>>;
  markDirty: () => void;
  onScreenRef: RefObject<boolean>;
  /** Notify the registration module that activeClouds changed (recompute onScreen). */
  onActiveChange: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const vwh = viewportWorldHeight(camera);
    const upSpan = viewportUpSpan(camera);
    const camUp = cameraUp(camera);
    const rest = new THREE.Vector3();
    const triggers: ScrollTrigger[] = [];

    clouds.forEach((c, i) => {
      const bind = c.section;
      if (!bind) return;
      const section = document.querySelector<HTMLElement>(bind.trigger);
      if (!section) return;

      placeOnRay(camera, c.ndc[0], c.ndc[1], c.dist, rest);
      const restX = rest.x;
      const restY = rest.y;
      const restZ = rest.z;

      const persp = !!c.perspectiveScroll;
      const travel = (bind.travel ?? 1) * (persp ? vwh : upSpan);

      const apply = (self: ScrollTrigger) => {
        const g = cloudRefs.current[i];
        if (!g) return;
        const d = -1 + 2 * self.progress; // offset from rest, in [-1, 1] x travel
        const off = d * travel;
        if (persp) {
          g.position.set(restX, restY + off, restZ);
        } else {
          g.position.set(
            restX + camUp.x * off,
            restY + camUp.y * off,
            restZ + camUp.z * off,
          );
        }
        if (onScreenRef.current) markDirty();
      };

      const setActive = (isActive: boolean) => {
        const before = activeClouds.current.size;
        if (isActive) activeClouds.current.add(c.key);
        else activeClouds.current.delete(c.key);
        if (activeClouds.current.size !== before) onActiveChange();
      };

      const st = ScrollTrigger.create({
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => apply(self),
        onRefresh: (self) => apply(self),
        onToggle: (self) => setActive(self.isActive),
      });
      triggers.push(st);
      apply(st); // seed (starts below when the section is still down-page)
      setActive(st.isActive); // seed a load that restores mid-section
    });

    const active = activeClouds.current;
    return () => {
      triggers.forEach((t) => t.kill());
      active.clear();
      onActiveChange();
    };
  }, [clouds, cloudRefs, activeClouds, camera, width, height, markDirty, onScreenRef, onActiveChange]);

  return null;
}

/**
 * Demand-mode painting helper. drei's <Clouds> builds its instanced geometry and
 * loads the texture over several frames, and its per-frame instance update lives
 * in a useFrame that only runs on a paint — so a single mount frame can paint
 * blank. We requestBurst a short run after mount (the host's canvas-mount burst
 * does NOT cover a view registering onto an ALREADY-mounted plane — on FRONT the
 * intro mounts the canvas first), plus a few delayed nudges for slower texture
 * decode, and a burst whenever the tab becomes visible again.
 */
function InvalidateOnReady({ requestBurst }: { requestBurst: (n: number) => void }) {
  useEffect(() => {
    requestBurst(8);
    const timers = [100, 300, 600].map((ms) =>
      window.setTimeout(() => requestBurst(1), ms),
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") requestBurst(1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [requestBurst]);
  return null;
}

/**
 * Cloud retint driver (theme controller). On a mode change it GSAP-tweens the
 * ambient + key lights' colour and intensity from their current values to
 * PALETTES[mode].cloud over the shared CROSSFADE — the same duration/ease the DOM
 * sky uses (theme-driver.tsx), so sky and clouds recolour together. Each tween
 * tick markDirty()s the demand view (during the welcome/on-screen the view is
 * already painting; the markDirty makes it correct for any demand moment).
 * IDLES TO ZERO: a settled mode runs no tween and paints nothing. First mount does
 * nothing — the lights are initialised to the mount mode's palette below.
 */
function ThemeRig({
  ambientRef,
  keyRef,
  markDirty,
}: {
  ambientRef: RefObject<THREE.AmbientLight | null>;
  keyRef: RefObject<THREE.DirectionalLight | null>;
  markDirty: () => void;
}) {
  const mode = useMode();
  const mounted = useRef(false);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const ambient = ambientRef.current;
    const key = keyRef.current;
    if (!ambient || !key) return;

    tweenRef.current?.kill();

    const target = PALETTES[mode].cloud;
    const ta = new THREE.Color(target.ambient.color);
    const tk = new THREE.Color(target.key.color);

    if (window.matchMedia(REDUCE_MOTION).matches) {
      ambient.color.copy(ta);
      ambient.intensity = target.ambient.intensity;
      key.color.copy(tk);
      key.intensity = target.key.intensity;
      markDirty();
      return;
    }

    const a0 = ambient.color.clone();
    const ai0 = ambient.intensity;
    const k0 = key.color.clone();
    const ki0 = key.intensity;
    const proxy = { p: 0 };
    tweenRef.current = gsap.to(proxy, {
      p: 1,
      duration: CROSSFADE.duration,
      ease: CROSSFADE.ease,
      onUpdate: () => {
        ambient.color.copy(a0).lerp(ta, proxy.p);
        ambient.intensity = ai0 + (target.ambient.intensity - ai0) * proxy.p;
        key.color.copy(k0).lerp(tk, proxy.p);
        key.intensity = ki0 + (target.key.intensity - ki0) * proxy.p;
        markDirty();
      },
    });

    return () => {
      tweenRef.current?.kill();
    };
  }, [mode, ambientRef, keyRef, markDirty]);

  return null;
}

/**
 * Intro reveal — the fade + downward settle the clouds do WITH the rock entrance.
 * The old CSS fade lived on the DOM wrapper; under the host the clouds render on
 * the shared plane, so the reveal is in-scene: material.opacity 0→1 (the drei
 * cloud fragment is diffuseColor.a * vOpacity, so material opacity scales every
 * cloud) + a small world-Y drift of the whole field. Seeded hidden only when the
 * intro will play; shown immediately otherwise (returning mid-page, skipped
 * intro). markDirty()s each tick. Reduced-motion devices never mount the WebGL
 * clouds (cloud-layer eligibility), so no snap branch is needed here.
 */
function RevealRig({
  cloudsRef,
  fieldRef,
  markDirty,
}: {
  cloudsRef: RefObject<Group | null>;
  fieldRef: RefObject<Group | null>;
  markDirty: () => void;
}) {
  const camera = useThree((s) => s.camera);

  // Seed hidden BEFORE the first paint if the intro will play, so the clouds
  // never flash in at full opacity under the welcome loader.
  useLayoutEffect(() => {
    if (!introWillPlay()) return;
    const mat = findCloudMaterial(cloudsRef.current);
    if (mat) {
      mat.transparent = true;
      mat.opacity = 0;
    }
  }, [cloudsRef]);

  useEffect(() => {
    if (!introWillPlay()) return;
    let tween: gsap.core.Tween | undefined;
    // Idempotency latch: START, REVEAL, and the failsafe ALL route here, and a
    // normal welcome fires the first two seconds apart — an unguarded reveal
    // would re-hide the settled clouds and fade them in a second time at the
    // dock (mirrors the `revealed` latch intro.tsx itself uses).
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      const mat = findCloudMaterial(cloudsRef.current);
      const g = fieldRef.current;
      // 14px of screen travel → world-Y at the field's reference depth. The
      // clouds start this far UP (invisible) and settle to rest as they fade in.
      const drift =
        (REVEAL_DRIFT_PX * viewportWorldHeight(camera)) / window.innerHeight;
      if (g) g.position.y = drift;
      const proxy = { p: 0 };
      tween?.kill();
      tween = gsap.to(proxy, {
        p: 1,
        duration: REVEAL_DUR,
        ease: "power2.out",
        onUpdate: () => {
          if (mat) mat.opacity = proxy.p;
          if (g) g.position.y = drift * (1 - proxy.p);
          markDirty();
        },
      });
    };
    window.addEventListener(INTRO_START_EVENT, reveal, { once: true });
    window.addEventListener(INTRO_REVEAL_EVENT, reveal, { once: true });
    const failsafe = window.setTimeout(reveal, 7000);
    return () => {
      window.removeEventListener(INTRO_START_EVENT, reveal);
      window.removeEventListener(INTRO_REVEAL_EVENT, reveal);
      window.clearTimeout(failsafe);
      tween?.kill();
    };
  }, [cloudsRef, fieldRef, camera, markDirty]);

  return null;
}

/**
 * Registers ONE cloud view on a shared plane. Renders nothing in the DOM — the
 * track/placeholder (a fixed inset-0 div) is the caller's own (cloud-layer.tsx);
 * the host's fixed plane Canvas scissors this view to the track's rect.
 *
 * PAINT POLICY (see the module header). `onScreen` = a field cloud is still
 * within pumpUntilVh of the top OR a section cloud is active. `scrolling` = a
 * scroll happened within SCROLL_IDLE_S. From those two booleans:
 *   - onScreen  → mode "continuous" (paint every visible tick, so the billow
 *                 advances); else "demand" (idle to zero — the fixed placeholder
 *                 defeats the host IO gate, so this feature-side gate is the idle).
 *   - scrolling → fpsCap "scroll" (uncapped on high → the field rides the display,
 *                 THE WELD); else MORPH_FPS 30 (the slow living billow's cadence).
 * On FRONT the ROCK view's "scroll" cap, dirty from scroll, wins the pump's
 * max-cap composition over the intro view's "heavy" 60 → the plane paints at
 * display rate and the rock clouds track the cliff feet with no half-rate stagger.
 */
export default function CloudView({
  plane,
  index,
  track,
  clouds,
  scrollFactor = DEFAULT_SCROLL_FACTOR,
}: {
  plane: PlaneName;
  index: number;
  track: RefObject<HTMLElement | null>;
  clouds: CloudSpec[];
  /** Per-layer scroll damping (1 = welded to page; < 1 = slower parallax). */
  scrollFactor?: number;
}) {
  // Stable paint-control wrappers. useSharedView RETURNS the controls, but the
  // scene `children` are an ARGUMENT to that same call, so they can't close over
  // the returned object — route through a ref pointed at the (stable) controls in
  // the commit's layout phase (before any child passive effect).
  const controlsRef = useRef<SharedViewControls | null>(null);
  const markDirty = useCallback(() => controlsRef.current?.markDirty(), []);
  const requestBurst = useCallback(
    (n: number) => controlsRef.current?.requestBurst(n),
    [],
  );

  // Split the specs once. Field clouds (anchorVh) parallax with the page via
  // <ScrollAnchorRig>+<CloudPlacement>, split again by axis (perspectiveScroll);
  // section clouds drift via <SectionRig>. pumpUntilVh = how deep (in vh of
  // scroll) some field cloud stays on screen (last anchorVh + slide-out margin).
  const split = useMemo(() => {
    const fieldClouds = clouds.filter((c) => !c.section);
    const sectionClouds = clouds.filter((c) => c.section);
    const perspFieldClouds = fieldClouds.filter((c) => c.perspectiveScroll);
    const flatFieldClouds = fieldClouds.filter((c) => !c.perspectiveScroll);
    const fieldMaxAnchorVh = fieldClouds.reduce(
      (max, c) => Math.max(max, c.anchorVh ?? 0),
      0,
    );
    const PUMP_MARGIN_VH = 1.5;
    return {
      fieldClouds,
      sectionClouds,
      perspFieldClouds,
      flatFieldClouds,
      pumpUntilVh: fieldMaxAnchorVh + PUMP_MARGIN_VH,
    };
  }, [clouds]);
  const { sectionClouds, perspFieldClouds, flatFieldClouds, pumpUntilVh } = split;
  const hasField = split.fieldClouds.length > 0;

  // ── Feature-side visibility + scroll gates (drive the descriptor) ──
  // Section clouds currently on screen — mutated by <SectionRig>, read here to
  // keep `onScreen` true while a section cloud is visible.
  const activeClouds = useRef<Set<string>>(new Set());
  const [fieldOnScreen, setFieldOnScreen] = useState(hasField);
  const [sectionOnScreen, setSectionOnScreen] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const onScreen = fieldOnScreen || sectionOnScreen;

  // Ref mirror for the scroll rigs (so they gate markDirty without re-running).
  const onScreenRef = useRef(onScreen);
  useEffect(() => {
    onScreenRef.current = onScreen;
  }, [onScreen]);

  const onActiveChange = useCallback(() => {
    setSectionOnScreen(activeClouds.current.size > 0);
  }, []);

  // Field on-screen gate: active once scrolled past the last field cloud's
  // on-screen range (trigger-less ST; `start` is a function so it re-resolves on
  // resize/refresh). cloudsOnScreen = !isActive.
  useEffect(() => {
    if (!hasField) return;
    gsap.registerPlugin(ScrollTrigger);
    // Seeded on screen by useState(hasField) — layout.tsx forces every load to
    // the top (manual scrollRestoration), so the field clouds (anchorVh 0) start
    // visible; onToggle tracks it from there (matches the old MorphRig seed).
    const st = ScrollTrigger.create({
      start: () => window.innerHeight * pumpUntilVh,
      end: "max",
      onToggle: (self) => setFieldOnScreen(!self.isActive),
    });
    return () => st.kill();
  }, [hasField, pumpUntilVh]);

  // Scroll-activity gate: hold fpsCap "scroll" (display rate) for SCROLL_IDLE_S
  // after the last scroll update, then drop back to the 30 fps morph cadence.
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    let clear: gsap.core.Tween | undefined;
    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: () => {
        setScrolling(true); // idempotent — React bails when already true
        clear?.kill();
        clear = gsap.delayedCall(SCROLL_IDLE_S, () => setScrolling(false));
      },
    });
    return () => {
      st.kill();
      clear?.kill();
    };
  }, []);

  // Repaint on re-entry: when the field/section comes back on screen, burst a few
  // frames so the (delta-clamped) morph is current when it re-appears.
  useEffect(() => {
    if (onScreen) requestBurst(2);
  }, [onScreen, requestBurst]);

  // Dev A/B hooks (2026-07-19 morph-cost tuning): ?morphfps=N overrides the
  // still-billow cadence; ?reardpr=N pins the REAR plane's dpr. Client-only
  // module (dynamic ssr:false), so reading location here is safe.
  const dev = useMemo(() => {
    if (typeof window === "undefined") return { morphFps: null as number | null, rearDpr: null as number | null };
    const q = new URLSearchParams(window.location.search);
    const m = Number(q.get("morphfps"));
    const d = Number(q.get("reardpr"));
    return {
      morphFps: m > 0 ? Math.min(m, 60) : null,
      rearDpr: d > 0 ? Math.min(d, 1.5) : null,
    };
  }, []);
  useEffect(() => {
    if (plane !== "rear" || dev.rearDpr === null) return;
    setPlaneDprOverride("rear", dev.rearDpr);
    return () => setPlaneDprOverride("rear", null);
  }, [plane, dev.rearDpr]);

  // With the morph off (MORPH_CLOUDS false) the shapes are frozen, so there is
  // nothing to paint while still: the view stays DEMAND everywhere and repaints
  // ride markDirty alone (scroll rigs at the "scroll" cap, theme tween, reveal,
  // placement). Still clouds = zero paints. ?morphfps=N re-enables the billow
  // for A/B without flipping the constant.
  const morphOn = MORPH_CLOUDS || dev.morphFps !== null;
  const mode = morphOn && onScreen ? "continuous" : "demand";
  const fpsCap = scrolling || !morphOn ? "scroll" : (dev.morphFps ?? MORPH_FPS);

  // The two theme lights — <ThemeRig> tweens their colour/intensity on a mode
  // change. Initialised to the CURRENT mode's palette so the first paint is
  // correct; when RETINT_CLOUDS is off they stay on the day palette.
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const keyRef = useRef<THREE.DirectionalLight | null>(null);
  const [initialCloud] = useState(
    () => (RETINT_CLOUDS ? PALETTES[getMode()] : PALETTES.day).cloud,
  );

  // Billboards per cloud — SNAPSHOT at mount (same pattern as the intro glass):
  // segments drive drei's instanced geometry, so honouring a mid-session tier
  // step-down live would rebuild the whole visible cloud field. dpr is a plane
  // ceiling (plane-canvas.tsx) and stays live because re-applying it is cheap.
  const [cloudSegments] = useState(() => getQualityConfig().cloudSegments);

  const cloudsRef = useRef<Group | null>(null);
  const fieldRootRef = useRef<Group | null>(null); // reveal drift wrapper
  const perspFieldRef = useRef<Group | null>(null);
  const flatFieldRef = useRef<Group | null>(null);
  const perspRefs = useRef<(Group | null)[]>([]);
  const flatRefs = useRef<(Group | null)[]>([]);
  const sectionRefs = useRef<(Group | null)[]>([]);

  // speed follows the morph toggle (drei scales morph phase AND rotation by it,
  // so 0 = fully frozen shapes); the ?morphfps hook re-enables it for A/B.
  const cloudSpeed = morphOn ? 0.1 : 0;
  const cloudBody = useCallback(
    (c: CloudSpec) => (
      <Cloud
        {...CLOUD}
        speed={cloudSpeed}
        segments={cloudSegments}
        seed={c.seed}
        bounds={c.bounds}
        volume={c.volume}
      />
    ),
    [cloudSegments, cloudSpeed],
  );

  const children: ReactNode = useMemo(
    () => (
      <>
        {/* Per-view camera + origin aim (replaces the standalone Canvas camera +
            onCreated lookAt). */}
        <PerspectiveCamera
          makeDefault
          position={CAMERA.position}
          fov={CAMERA.fov}
          near={0.1}
          far={1000}
        />
        <CameraRig />

        {/* Position-independent light rig: a directional key + ambient fill light
            every cloud identically. Colour/intensity from the current mode's
            palette; <ThemeRig> tweens them per mode. */}
        <ambientLight
          ref={ambientRef}
          color={initialCloud.ambient.color}
          intensity={initialCloud.ambient.intensity}
        />
        <directionalLight
          ref={keyRef}
          color={initialCloud.key.color}
          intensity={initialCloud.key.intensity}
          position={KEY_LIGHT_POSITION}
        />

        <Clouds
          ref={cloudsRef}
          material={THREE.MeshLambertMaterial}
          texture="/textures/cloud-puff.png"
          limit={400}
          range={RANGE}
          frustumCulled={false}
        >
          {/* Reveal-drift wrapper: <RevealRig> translates this whole field on the
              intro settle; the rigs below translate the inner groups on scroll, so
              the two compose. */}
          <group ref={fieldRootRef}>
            {/* Perspective field clouds: <ScrollAnchorRig> translates this group
                along world-Y on scroll (swell). */}
            <group ref={perspFieldRef}>
              {perspFieldClouds.map((c, i) => (
                <group
                  key={c.key}
                  ref={(el) => {
                    perspRefs.current[i] = el;
                  }}
                >
                  {cloudBody(c)}
                </group>
              ))}
            </group>

            {/* Flat field clouds: translated along the camera-up axis (constant size). */}
            <group ref={flatFieldRef}>
              {flatFieldClouds.map((c, i) => (
                <group
                  key={c.key}
                  ref={(el) => {
                    flatRefs.current[i] = el;
                  }}
                >
                  {cloudBody(c)}
                </group>
              ))}
            </group>

            {/* Section clouds: driven by their section's crossing via <SectionRig>. */}
            {sectionClouds.map((c, i) => (
              <group
                key={c.key}
                ref={(el) => {
                  sectionRefs.current[i] = el;
                }}
              >
                {cloudBody(c)}
              </group>
            ))}
          </group>
        </Clouds>

        {perspFieldClouds.length > 0 && (
          <>
            <CloudPlacement
              clouds={perspFieldClouds}
              cloudRefs={perspRefs}
              scrollFactor={scrollFactor}
              perspective
              markDirty={markDirty}
            />
            <ScrollAnchorRig
              groupRef={perspFieldRef}
              scrollFactor={scrollFactor}
              perspective
              markDirty={markDirty}
              onScreenRef={onScreenRef}
            />
          </>
        )}
        {flatFieldClouds.length > 0 && (
          <>
            <CloudPlacement
              clouds={flatFieldClouds}
              cloudRefs={flatRefs}
              scrollFactor={scrollFactor}
              perspective={false}
              markDirty={markDirty}
            />
            <ScrollAnchorRig
              groupRef={flatFieldRef}
              scrollFactor={scrollFactor}
              perspective={false}
              markDirty={markDirty}
              onScreenRef={onScreenRef}
            />
          </>
        )}
        <SectionRig
          clouds={sectionClouds}
          cloudRefs={sectionRefs}
          activeClouds={activeClouds}
          markDirty={markDirty}
          onScreenRef={onScreenRef}
          onActiveChange={onActiveChange}
        />
        <InvalidateOnReady requestBurst={requestBurst} />
        {RETINT_CLOUDS && (
          <ThemeRig ambientRef={ambientRef} keyRef={keyRef} markDirty={markDirty} />
        )}
        <RevealRig cloudsRef={cloudsRef} fieldRef={fieldRootRef} markDirty={markDirty} />
      </>
    ),
    [
      perspFieldClouds,
      flatFieldClouds,
      sectionClouds,
      scrollFactor,
      initialCloud,
      cloudBody,
      markDirty,
      requestBurst,
      onActiveChange,
    ],
  );

  const controls = useSharedView({
    plane,
    index,
    track,
    // ACESFilmic (R3F's default): the bright key light carries the cloud white.
    // Declared here so the host's per-view setter restores it before the cloud
    // renders — on FRONT it alternates with the intro view's NoToneMapping.
    toneMapping: THREE.ACESFilmicToneMapping,
    mode,
    fpsCap,
    children,
  });
  // Point the wrapper ref at the (stable) controls in the commit's LAYOUT phase —
  // before any child passive effect (e.g. ScrollAnchorRig's seed markDirty), so
  // those wrappers are never a null no-op.
  useLayoutEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  return null;
}

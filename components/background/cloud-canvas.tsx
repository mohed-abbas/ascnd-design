"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Cloud, Clouds } from "@react-three/drei";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Group } from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { CloudSpec } from "./cloud-specs";
import { useQuality } from "@/lib/perf/use-quality";
import { getQualityConfig } from "@/lib/perf/quality-store";
import { makeCappedInvalidate } from "@/lib/perf/capped-invalidate";
import { useMode } from "@/lib/theme/use-mode";
import { getMode } from "@/lib/theme/mode-store";
import { CROSSFADE, PALETTES } from "@/lib/theme/palette";

/**
 * Volumetric cloud field (Three.js / R3F + drei <Clouds>).
 *
 * This is the /lab/clouds reference cloud ported into the global background:
 * lit drei <Cloud>s on a <MeshLambertMaterial>, framed from a 3/4 above-front
 * camera. Lighting is a white directional key + ambient (CLOUD_THEME) — chosen
 * over the lab's positioned spotlights so every cloud is lit identically
 * wherever it's placed (uniformly white, no position tint) and so theme modes
 * (evening/night) drop in as light-colour swaps. The look was tuned in
 * /lab/clouds and baked below (no leva here). Each hero cloud is anchored to a
 * screen spot via NDC (top-right corner + the two rock bases) by
 * <CloudPlacement>. More clouds/sections to come — this is the hero set.
 *
 * Render strategy (see docs/cloud-rendering-research.md §9) is unchanged from
 * the previous cloud and deliberately diverges from the lab:
 * - frameloop="demand": no free-running rAF. We paint on change — scroll
 *   parallax, the first mount frames (drei builds geometry + loads the texture
 *   over several frames), tab re-show, WebGL context restore — plus a THROTTLED
 *   ~30fps pump (<MorphRig>) that drives the clouds' slow living morph without a
 *   second rAF (it rides GSAP's ticker, which the browser parks on hidden tabs).
 *   (The lab auto-rotates on a continuous loop; here the field instead translates
 *   vertically with page scroll via <ScrollAnchorRig>, so clouds move with the
 *   document rather than staying pinned to the viewport.)
 * - Transparent canvas (alpha): the cloud composites over the DOM sky — the
 *   flat #62abff fill + grain stay in <Background/>. (The lab paints a drei
 *   <Sky>; we keep the confirmed flat sky, so no <Sky> here.)
 * - Self-hosted sprite texture (/textures/cloud-puff.png) — a LOCAL COPY of
 *   drei's detailed cloud sprite (the one the lab gets from its CDN default),
 *   not hit at runtime (reliability/offline/privacy mandate, §9). It must be a
 *   detailed painted puff: the old /textures/cloud.png was a featureless radial
 *   blob, which is why the cloud rendered as a washed-out blur with no form.
 * - antialias ON and dpr up to 2 (was off/1.5) so the sprite detail isn't
 *   softened on retina — this matches the lab's crisp render. Single batched
 *   <Clouds> draw, no shadows; still desktop-only (gated ≤768px), so affordable.
 * - frustumCulled={false} on <Clouds>: the internal InstancedMesh has a stale
 *   bounding sphere under parallax, which would cull the whole batch and make
 *   the cloud vanish on scroll. One batched mesh, so always-drawing is cheap.
 * - Tone mapping is left at R3F's default (ACES), matching the lab — the bright
 *   key light carries the white, so the old NoToneMapping override (needed by
 *   the previous unlit MeshBasicMaterial path) is gone.
 *
 * Context-loss resilience: we rely on THREE.WebGLRenderer's BUILT-IN
 * webglcontextlost/restored handling — no manual preventDefault() (a documented
 * anti-pattern that leaks across Fast Refresh). <ContextWatchdog> only repaints
 * on restore and remounts the <Canvas> if a real driver reset never restores.
 */

// Shared cloud look (tuned in /lab/clouds; the dev leva panel is gone). Size,
// seed and placement are per-cloud in the specs. `speed` is small + non-zero so
// the puffs slowly morph (lively, not churning); <MorphRig> pumps the demand
// loop at ~30fps so that morph actually advances. To re-tune the look, play in
// /lab/clouds. `segments` (the fill-rate knob) is tiered — see cloudSegments
// in lib/perf/tiers.ts, snapshotted at mount in <CloudCanvas>.
const CLOUD = {
  opacity: 0.8,
  fade: 10,
  growth: 4,
  speed: 0.25,
  color: "white",
} as const;
// Max cloud SEGMENTS rendered per <Clouds> batch. drei draws
// count = min(limit, range, totalSegments) sprites, where each <Cloud> expands
// into `segments` billboards (cloudSegments: 20 on the high tier). So this is a
// hard ceiling on the CLOUD COUNT: range/segments = 400/20 = 20 high-tier clouds
// per canvas. It was 100 (= only 5 high-tier clouds — a 6th silently dropped its
// segments). Kept equal to `limit` below so the buffer, not this, is the ceiling.
// Raising it is free until the segments actually exist — cost tracks the clouds
// you place (on-screen overdraw), not this cap. Bump `limit` too if you exceed 20.
const RANGE = 400;

// Cloud placements (NDC/dist/size) live in cloud-specs.ts — see CloudSpec.

// Baked camera — a 3/4 above-front view; the angle plus the sprite's own
// painted shading is what makes the billboards read as dimensional.
const CAMERA = { position: [0, 11, 18] as [number, number, number], fov: 50 };

// Cloud lighting is position-INDEPENDENT (only ambient + directional, no spot
// lights) so a cloud is lit identically wherever it sits — which is exactly what
// makes theming a clean colour swap. The per-mode ambient/key colours+intensities
// now live in lib/theme/palette.ts (PALETTES[mode].cloud); <ThemeRig> tweens the
// two lights when the mode changes, in lockstep with the DOM sky (same CROSSFADE).
// The key light's DIRECTION is mode-invariant, so it stays here (it's a direction —
// light → origin — not a place, so there's no distance falloff).
const KEY_LIGHT_POSITION = [0, 20, 12] as [number, number, number];

// Flip to false to REVERT to always-white clouds (day lighting in every mode):
// <ThemeRig> won't mount and the lights initialise to the day palette, so the sky
// gradient still changes but the clouds stop retinting. See palette.ts.
const RETINT_CLOUDS = true;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// Reference depth (world units along the camera ray) for the scroll math. The
// hero clouds all sit here, so the scroll→world conversion below is exact for
// them. Clouds at other depths get a subtle parallax, which is fine.
const REF_DIST = 22;

// Scroll parallax damping: how far the cloud field travels per unit of page
// scroll. 1 = locked 1:1 to the page (welded to the rocks); < 1 = the clouds
// drift slower than the content for a calmer, more background-like motion. The
// SAME factor scales the anchorVh offset in <CloudPlacement>, so each section's
// clouds still arrive at their rest spot exactly when its scroll is reached —
// only the speed of travel changes, not where they settle.
//
// This is PER-LAYER (a prop, not a constant): the FRONT rock-base clouds MUST
// stay at 1.0 — they're glued to the cliff feet, which are page content scrolling
// 1:1, so any value < 1 makes them slide off the rocks. Only the distant SKY
// clouds are damped (slower-than-page parallax reads as depth, and is where
// "calmer scroll motion" actually belongs). cloud-layer.tsx sets each.
const DEFAULT_SCROLL_FACTOR = 1;

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
 * axis between them moves it up the screen at CONSTANT distance-to-camera (no
 * swell) — unlike viewportWorldHeight()'s world-Y span, which the ~31° tilt
 * turns into a depth (size) change.
 */
function viewportUpSpan(camera: THREE.Camera) {
  placeOnRay(camera, 0, 1, REF_DIST, _vTop);
  placeOnRay(camera, 0, -1, REF_DIST, _vBot);
  return _vTop.distanceTo(_vBot);
}

/**
 * The camera's up-axis in world space (matrixWorld column 1). This is the FLAT
 * scroll axis: perpendicular to the view direction, so travelling along it is
 * pure screen-vertical motion with no depth (size) change. The camera is static,
 * so this is constant — computed once per rig/placement, never per frame.
 */
function cameraUp(camera: THREE.Camera) {
  return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
}

/**
 * Anchors each cloud to its target screen position. For each CloudSpec it
 * unprojects the NDC through the camera to a ray, walks `dist` down that ray,
 * and writes the world point to the cloud's group — so the cloud sits at that
 * screen spot at any aspect. `anchorVh` then pushes it down the world by that
 * many viewports, so section-N clouds start off-screen-below and <ScrollAnchorRig>
 * lifts them into view at the right scroll. Recomputes on resize; demand mode,
 * so invalidate() to paint. (Mutating group.position via a ref is fine — only
 * `camera` would trip the immutability rule, and we only read it.)
 */
function CloudPlacement({
  clouds,
  cloudRefs,
  scrollFactor,
  perspective,
}: {
  clouds: CloudSpec[];
  cloudRefs: React.RefObject<(Group | null)[]>;
  scrollFactor: number;
  /**
   * Match the cloud's <ScrollAnchorRig>: offset the anchorVh baseline along
   * world-Y (true) or the camera-up axis (false), so the cloud still arrives at
   * its rest spot at the right scroll whichever axis it travels on.
   */
  perspective: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    // anchorVh is baked along the SAME axis the cloud scrolls on: world-Y for
    // perspective clouds, camera-up (with its own edge-length calibration) for
    // flat ones. All current field clouds use anchorVh 0..3.
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
    invalidate();
  }, [clouds, camera, width, height, invalidate, cloudRefs, scrollFactor, perspective]);

  return null;
}

/**
 * Scroll anchoring (approach C): translate the whole cloud field UP in world
 * space as the page scrolls, so clouds move with the document instead of being
 * pinned to the viewport. The conversion (scroll px → world units) is calibrated
 * to REF_DIST, then damped by SCROLL_FACTOR so the clouds drift slower than the
 * page (calmer, background-like) while still settling at their rest spot. Each
 * section's clouds (anchorVh) rise into frame as you reach them.
 */
function ScrollAnchorRig({
  groupRef,
  scrollFactor,
  perspective,
}: {
  groupRef: React.RefObject<Group | null>;
  scrollFactor: number;
  /**
   * true → travel along world-Y (the ~31° tilt makes clouds swell toward the
   * camera as they rise — the perspective look). false → travel along the
   * camera-up axis, so clouds move up the screen at CONSTANT size (flat). Set
   * per cloud via `perspectiveScroll` in cloud-specs.ts.
   */
  perspective: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    // Each mode has its own scroll→world calibration — the world-Y span for
    // perspective, the full camera-up edge length for flat — so both travel one
    // screen-viewport per scrolled viewport. camUp is only used by the flat path.
    const worldPerPx =
      (perspective ? viewportWorldHeight(camera) : viewportUpSpan(camera)) /
      window.innerHeight;
    const camUp = perspective ? null : cameraUp(camera);
    // Scroll updates arrive at up to panel rate (120 Hz); repaints past the
    // heavy-effect cap buy nothing visible, so throttle with a trailing paint
    // (the group position is still written per update — only paints are capped).
    const capped = makeCappedInvalidate(invalidate);

    const apply = (scroll: number) => {
      const g = groupRef.current;
      if (!g) return;
      const d = scroll * worldPerPx * scrollFactor;
      if (perspective) {
        g.position.set(0, d, 0);
      } else {
        g.position.set(camUp!.x * d, camUp!.y * d, camUp!.z * d);
      }
      capped();
    };

    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      scrub: true,
      onUpdate: (self) => apply(self.scroll()),
    });

    // Seed the position for a load that restores mid-page (scrub fires lazily).
    apply(window.scrollY || 0);

    // Re-seed after every refresh. ScrollTrigger.refresh() (fired on ANY resize)
    // reverts the scroller to 0 to measure, which runs the scrub onUpdate above
    // with scroll=0 and snaps this whole field group back to position.y=0 — its
    // hero anchor — so on a demand canvas the field clouds flash back onto the
    // hero for a frame or two, whatever the actual scroll, until the next scroll
    // corrects it. Re-applying the true scroll once the refresh has restored the
    // scroller overwrites that stale frame. st.scroll() (not window.scrollY,
    // which can read 0 for a tick under Lenis) reflects the restored position.
    // (SectionRig doesn't need this — it already re-seeds via onRefresh.)
    const onRefresh = () => apply(st.scroll());
    ScrollTrigger.addEventListener("refresh", onRefresh);

    return () => {
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      st.kill();
      capped.cancel();
    };
    // width/height: recompute worldPerPx when the viewport (and thus the world
    // height at REF_DIST) changes.
  }, [groupRef, camera, width, height, invalidate, scrollFactor, perspective]);

  return null;
}

/**
 * Section-anchored clouds. Like the field clouds (hero + rock bases) they drift
 * continuously with scroll, but a section cloud is driven by ITS OWN section's
 * scroll crossing (a scrubbed ScrollTrigger on the section element) rather than
 * by an absolute `anchorVh` — so it needs no viewport-height counting and is
 * robust to sections being reordered above it. These clouds sit OUTSIDE the
 * parallax field group, so only this rig moves them.
 *
 * Motion — Option B, continuous monotonic drift: a single LINEAR mapping over the
 * whole crossing (section top at viewport bottom -> section bottom at viewport
 * top). The cloud drifts at CONSTANT velocity from `travel` below its `ndc` rest
 * spot, through rest exactly when the section is centred, up to `travel` above as
 * it leaves — no hold. It rises slowly, passes through its corner and keeps
 * floating out, matching the anchorVh clouds' feel.
 *
 * This replaced an earlier slide -> HOLD -> slide curve (fixed 0.7vh slides + a
 * motionless middle) that felt too fast on entry and read as "pinned" while
 * docked. That docking behaviour — useful for a cloud that should pin beside a
 * PINNED section — is preserved as a documented future opt-in (Option C: a
 * `hold?` flag on SectionBind that restores the piecewise curve, using
 * `bind.slide`). See docs/cloud-rendering-research.md § "Section-cloud motion".
 * Demand mode, so each update invalidate()s a repaint.
 *
 * The drift axis honours each cloud's `perspectiveScroll` (cloud-specs.ts): flat
 * clouds (default) drift along the camera-up axis at constant size; perspective
 * clouds drift along world-Y and swell toward the lens — same toggle the field
 * rig uses, so section and field clouds behave consistently.
 */
function SectionRig({
  clouds,
  cloudRefs,
  activeClouds,
}: {
  clouds: CloudSpec[];
  cloudRefs: React.RefObject<(Group | null)[]>;
  /** Shared with <MorphRig>: which section clouds are on screen right now. */
  activeClouds: React.RefObject<Set<string>>;
}) {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    // Both slide axes: world-Y span (perspective — swells) and camera-up edge
    // length (flat — constant size). Per-cloud `perspectiveScroll` picks which.
    const vwh = viewportWorldHeight(camera);
    const upSpan = viewportUpSpan(camera);
    const camUp = cameraUp(camera);
    const rest = new THREE.Vector3();
    const triggers: ScrollTrigger[] = [];
    // One shared cap across all section clouds — they repaint the same canvas,
    // so a single trailing paint covers every cloud's last update.
    const capped = makeCappedInvalidate(invalidate);

    clouds.forEach((c, i) => {
      const bind = c.section;
      if (!bind) return;
      const section = document.querySelector<HTMLElement>(bind.trigger);
      if (!section) return;

      // Rest world point at the cloud's ndc/dist — where it holds while its
      // section is on screen.
      placeOnRay(camera, c.ndc[0], c.ndc[1], c.dist, rest);
      const restX = rest.x;
      const restY = rest.y;
      const restZ = rest.z;

      // Flat clouds drift along the camera-up axis (calibrated by upSpan);
      // perspective clouds drift along world-Y (vwh) and swell as they go.
      const persp = !!c.perspectiveScroll;
      const travel = (bind.travel ?? 1) * (persp ? vwh : upSpan); // world units swept to each side of rest

      // Option B — continuous monotonic drift. A single LINEAR mapping over the
      // whole crossing, no hold: progress 0 (section entering at viewport bottom)
      // -> d = -1 (travel below rest); progress 0.5 (section centred) -> d = 0
      // (rest at the cloud's ndc spot); progress 1 (section leaving at viewport
      // top) -> d = +1 (travel above). Constant velocity, so the cloud drifts
      // slowly up, passes through its corner rest spot and keeps floating out —
      // the anchorVh field-cloud feel, but section-anchored (no viewport-height
      // counting). This replaced an earlier slide -> HOLD -> slide curve whose
      // fixed 0.7vh slides felt fast and whose motionless middle read as "pinned".
      // (`bind.slide` is intentionally unused here; it returns only if the docking
      // hold is reintroduced as an opt-in — Option C, see
      // docs/cloud-rendering-research.md § "Section-cloud motion".)
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
        capped();
      };

      // Report on-screen state to the shared set so <MorphRig> keeps the
      // living morph pumping while this cloud is visible. Set add/delete is
      // idempotent, so refresh-time re-fires are harmless.
      const setActive = (isActive: boolean) => {
        if (isActive) activeClouds.current.add(c.key);
        else activeClouds.current.delete(c.key);
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
      capped.cancel();
      clouds.forEach((c) => active.delete(c.key));
    };
    // width/height: rest point + vwh depend on the projected viewport.
  }, [clouds, cloudRefs, activeClouds, camera, width, height, invalidate]);

  return null;
}

/**
 * Living-morph pump. The clouds carry a small `speed`, but drei advances that
 * morph inside a useFrame that only runs when a frame is requested — and we
 * render on demand. So we request frames on a THROTTLED cadence (~30fps; a slow
 * billow needs no more) off GSAP's ticker — the same one Lenis drives, so there
 * is still no second rAF loop. The browser parks rAF on hidden tabs, so this
 * idles automatically when the page isn't visible. Desktop-gated upstream, and
 * reduced-motion never mounts the canvas, so the steady repaint is affordable.
 *
 * The pump must run for as long as ANY cloud is on screen, or a visible cloud
 * freezes its morph — and, because drei drives the billow off the clock's
 * ABSOLUTE elapsedTime with a demand-mode getDelta() (real wall-clock between
 * repaints), the next scroll-driven repaint after an idle gap lands a huge
 * delta and POPS the morph forward in one frame (the stutter this rig exists to
 * prevent). The field clouds parallax with the page, so each reaches its rest
 * spot at scroll = anchorVh viewports and clears the top edge ~1.5 vh later
 * (scrollFactor cancels in that settle math). `pumpUntilVh` is therefore the
 * LAST cloud's anchorVh + that margin — computed from the specs in <CloudCanvas>
 * so the pump covers the real cloud range (the cards/why-stay clouds sit at
 * anchorVh up to ~4), not a fixed hero-only cutoff. The <SectionRig> path is
 * kept for any future `section`-bound clouds.
 */
function MorphRig({
  activeClouds,
  pumpUntilVh,
}: {
  /** Section clouds currently on screen, maintained by <SectionRig>. */
  activeClouds: React.RefObject<Set<string>>;
  /**
   * Scroll depth (in viewport-heights) below which some field cloud is still on
   * screen, so the morph must keep pumping. = max field anchorVh + slide-out
   * margin; see <CloudCanvas>.
   */
  pumpUntilVh: number;
}) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const STEP = 1 / 30; // seconds between repaints
    let last = 0;
    // Pause the pump only once EVERY field cloud has scrolled off the top and no
    // section cloud is reported on screen — i.e. nothing morphing is visible. A
    // frozen morph off-screen costs nothing and is invisible; we repaint once on
    // the way back so the clouds are current when they re-enter (audit R5).
    let cloudsOnScreen = true;
    // gsap.ticker passes elapsed time in seconds; throttle to STEP. `last`
    // advances in whole STEPs (not `last = time`) so the leftover fraction of a
    // tick carries over — a true 30 fps average instead of drifting to ~27.
    const tick = (time: number) => {
      if (!cloudsOnScreen && activeClouds.current.size === 0) return;
      if (time - last >= STEP) {
        last = time - ((time - last) % STEP);
        invalidate();
      }
    };
    gsap.ticker.add(tick);

    // Trigger-less ScrollTrigger: active once scrolled past the last field
    // cloud's on-screen range, where the parallaxing clouds are all gone.
    // `start` is a function so it re-resolves on resize/refresh.
    const st = ScrollTrigger.create({
      start: () => window.innerHeight * pumpUntilVh,
      end: "max",
      onToggle: (self) => {
        cloudsOnScreen = !self.isActive;
        if (cloudsOnScreen) invalidate(); // repaint the skipped frame on return
      },
    });

    return () => {
      gsap.ticker.remove(tick);
      st.kill();
    };
  }, [invalidate, activeClouds, pumpUntilVh]);

  return null;
}

/**
 * Demand-mode painting helper. drei's <Clouds> builds its instanced geometry
 * and loads the texture over several frames, and its per-frame instance update
 * lives in a useFrame that only runs when a frame is requested — so a single
 * mount frame can paint blank. We pump invalidate() for a short burst after
 * mount (and a few delayed nudges to cover slower texture decode), then repaint
 * whenever the tab becomes visible again (throttled tabs drop the last frame).
 */
function InvalidateOnReady() {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    let raf = 0;
    let frames = 0;
    const pump = () => {
      invalidate();
      if (++frames < 8) raf = requestAnimationFrame(pump);
    };
    pump();

    // Insurance against texture decode landing after the rAF burst.
    const timers = [100, 300, 600].map((ms) => setTimeout(invalidate, ms));

    const onVisible = () => {
      if (document.visibilityState === "visible") invalidate();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [invalidate]);

  return null;
}

/**
 * WebGL context-loss safety net. THREE handles lost/restored internally; here
 * we only (a) repaint after a restore (demand mode needs an explicit frame) and
 * (b) if a restore never arrives within a few seconds (unrecoverable driver
 * reset), ask the parent to remount the <Canvas> with a fresh context. All
 * listeners/timers are cleaned up, so nothing accumulates across Strict Mode /
 * Fast Refresh.
 */
function ContextWatchdog({
  onUnrecoverable,
}: {
  onUnrecoverable: () => void;
}) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const canvas = gl.domElement;
    let mounted = true;
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;

    const onLost = () => {
      // THREE already calls preventDefault() and will restore on its own for
      // recoverable losses. Arm a fallback only for a loss that never restores.
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => {
        // Remount ONLY a genuinely unrecoverable loss on a still-live, visible
        // canvas. This skips R3F's intentional force-context-loss during
        // unmount (the canvas is detached by the time the timer fires) and
        // stale timers from a previous Strict Mode / Fast Refresh instance —
        // both of which would otherwise cause a needless remount.
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
      invalidate();
    };

    canvas.addEventListener("webglcontextlost", onLost, false);
    canvas.addEventListener("webglcontextrestored", onRestored, false);

    return () => {
      mounted = false;
      if (restoreTimer) clearTimeout(restoreTimer);
      canvas.removeEventListener("webglcontextlost", onLost, false);
      canvas.removeEventListener("webglcontextrestored", onRestored, false);
    };
  }, [gl, invalidate, onUnrecoverable]);

  return null;
}

/**
 * Cloud retint driver (theme controller). Renders nothing. On a mode change it
 * GSAP-tweens the ambient + key lights' colour and intensity from their current
 * values to PALETTES[mode].cloud over the shared CROSSFADE — the same duration/
 * ease the DOM sky uses (theme-driver.tsx), so sky and clouds recolour together.
 *
 * House-rules compliance:
 * - Rides GSAP's shared ticker (no private rAF); the demand loop is pumped by a
 *   CAPPED invalidate() each tick (heavyEffectFpsCap), and only during a switch.
 * - IDLES TO ZERO: a settled mode runs no tween and paints nothing.
 * - First mount does nothing — the lights are initialised to the mount mode's
 *   palette in <CloudCanvas>. Reduced-motion snaps (no animation).
 * Only mounted when RETINT_CLOUDS is true.
 */
function ThemeRig({
  ambientRef,
  keyRef,
}: {
  ambientRef: React.RefObject<THREE.AmbientLight | null>;
  keyRef: React.RefObject<THREE.DirectionalLight | null>;
}) {
  const mode = useMode();
  const invalidate = useThree((s) => s.invalidate);
  const mounted = useRef(false);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    // First run: lights already initialised to this mode's palette (CloudCanvas).
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
      invalidate();
      return;
    }

    // Snapshot the outgoing light state, then lerp both lights off one proxy so
    // colour + intensity share the ease/duration. A capped invalidate() repaints
    // the demand canvas through the crossfade (trailing paint guarantees the
    // final frame lands on the target).
    const a0 = ambient.color.clone();
    const ai0 = ambient.intensity;
    const k0 = key.color.clone();
    const ki0 = key.intensity;
    const capped = makeCappedInvalidate(invalidate);
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
        capped();
      },
      onComplete: () => capped.cancel(),
    });

    return () => {
      tweenRef.current?.kill();
      capped.cancel();
    };
  }, [mode, ambientRef, keyRef, invalidate]);

  return null;
}

export default function CloudCanvas({
  clouds,
  scrollFactor = DEFAULT_SCROLL_FACTOR,
}: {
  clouds: CloudSpec[];
  /** Per-layer scroll damping (1 = welded to page; < 1 = slower parallax). */
  scrollFactor?: number;
}) {
  // Field clouds (hero + rock bases) parallax with the page via <ScrollAnchorRig>
  // + <CloudPlacement>; section clouds (bound to a section) slide/hold/slide via
  // <SectionRig>. Split so each set gets the right rig and its own ref list.
  const fieldClouds = clouds.filter((c) => !c.section);
  const sectionClouds = clouds.filter((c) => c.section);
  // Field clouds split again by SCROLL AXIS (perspectiveScroll): perspective
  // clouds travel along world-Y and swell toward the camera; flat clouds travel
  // along the camera-up axis at constant size. Each axis gets its own wrapper
  // group + rig, so the perspective path stays identical to before and the flat
  // path is a clean parallel. Groups with no clouds render nothing and get no rig.
  const perspFieldClouds = fieldClouds.filter((c) => c.perspectiveScroll);
  const flatFieldClouds = fieldClouds.filter((c) => !c.perspectiveScroll);

  // How deep (in viewport-heights of scroll) the field clouds stay on screen —
  // the last cloud reaches its rest at scroll = anchorVh vh and clears the top
  // edge ~1.5 vh after, so <MorphRig> must keep pumping until then or that cloud
  // freezes its morph while still visible. For the rock-base layer (anchorVh 0)
  // this is ~1.5 vh, matching the old hero-only cutoff; for the sky layer it
  // extends to cover the cards/why-stay clouds (anchorVh up to ~4).
  const PUMP_MARGIN_VH = 1.5;
  const fieldMaxAnchorVh = fieldClouds.reduce(
    (max, c) => Math.max(max, c.anchorVh ?? 0),
    0,
  );
  const pumpUntilVh = fieldMaxAnchorVh + PUMP_MARGIN_VH;

  const perspFieldRef = useRef<Group | null>(null);
  const flatFieldRef = useRef<Group | null>(null);
  const perspRefs = useRef<(Group | null)[]>([]);
  const flatRefs = useRef<(Group | null)[]>([]);
  const sectionRefs = useRef<(Group | null)[]>([]);
  // The two theme lights — <ThemeRig> tweens their colour/intensity on a mode
  // change. Initialised (below) to the CURRENT mode's palette so the first paint
  // is already correct; when RETINT_CLOUDS is off they stay on the day palette.
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const keyRef = useRef<THREE.DirectionalLight | null>(null);
  // Snapshot at mount (the canvas is ssr:false, so getMode() reads the real
  // persisted mode here). Not bound to live mode — ThemeRig owns the lights
  // imperatively so a switch TWEENS rather than snapping via a prop change.
  const [initialCloud] = useState(
    () => (RETINT_CLOUDS ? PALETTES[getMode()] : PALETTES.day).cloud,
  );
  // Which section clouds are on screen — written by <SectionRig>, read by
  // <MorphRig> to keep their living morph pumping while visible. Empty on a
  // field-only canvas (the ROCK layer), which keeps the plain 1.5 vh rule.
  const activeClouds = useRef<Set<string>>(new Set());
  // Bumping this remounts the <Canvas> with a fresh GL context — last resort
  // when a lost context never restores. See <ContextWatchdog>.
  const [canvasKey, setCanvasKey] = useState(0);
  const remount = useCallback(() => setCanvasKey((k) => k + 1), []);

  // Adaptive dpr cap (docs/performance-audit.md §6): the soft sprite hides low
  // device-pixel-ratio, so a struggling machine can drop the ceiling (high 2 →
  // low 1.25) to quarter the FBO fragment count. R3F re-applies dpr on change.
  const { cloudDprMax } = useQuality();
  // Billboards per cloud — SNAPSHOT at mount (same pattern as the intro glass):
  // segments drive drei's instanced geometry, so honouring a mid-session tier
  // step-down live would rebuild the whole visible cloud field. dpr above stays
  // live because re-applying it is cheap and invisible.
  const [cloudSegments] = useState(() => getQualityConfig().cloudSegments);

  // One <Cloud> body for every group — only the seed/bounds/volume differ. The
  // owning <group>'s ref callback stays inline per map (the lint rule needs the
  // ref write in a callback it can see, not passed through a helper).
  const cloudBody = (c: CloudSpec) => (
    <Cloud
      {...CLOUD}
      segments={cloudSegments}
      seed={c.seed}
      bounds={c.bounds}
      volume={c.volume}
    />
  );

  return (
    <Canvas
      key={canvasKey}
      frameloop="demand"
      dpr={[1, cloudDprMax]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: CAMERA.position, fov: CAMERA.fov }}
      // Aim the static camera at the origin once, before the first frame, so
      // <CloudPlacement>'s unproject reads a settled view matrix.
      onCreated={({ camera }) => {
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
      }}
      // pointer-events:none is REQUIRED here: R3F sets the <canvas> to
      // pointer-events:auto (it manages its own 3D pointer events), which
      // overrides the wrapper's `pointer-events-none`. Without this, the
      // full-viewport front canvas (z-[1]) swallows every pointermove and the
      // hero's grass-rock hover (rock-hover.tsx, listening on [data-hero])
      // never fires. The clouds are purely decorative, so no interaction is lost.
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {/* Position-independent light rig: a directional key + ambient fill light
          every cloud identically, wherever it sits, so they carry no position
          tint. Colour/intensity come from the current mode's palette (initialCloud)
          and are tweened per-mode by <ThemeRig> (mounted below when retinting). */}
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
        material={THREE.MeshLambertMaterial}
        texture="/textures/cloud-puff.png"
        limit={400}
        range={RANGE}
        frustumCulled={false}
      >
        {/* Perspective field clouds: <ScrollAnchorRig> translates this whole
            group along world-Y on scroll (swell); each sits at its own screen-
            anchored position inside it (set by <CloudPlacement>). */}
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

        {/* Flat field clouds: same idea, but the group is translated along the
            camera-up axis so they move up the screen at constant size. */}
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

        {/* Section clouds: OUTSIDE the field groups (no page parallax); driven by
            their section's crossing via <SectionRig> (slide in → hold → slide out). */}
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
      </Clouds>

      {perspFieldClouds.length > 0 && (
        <>
          <CloudPlacement clouds={perspFieldClouds} cloudRefs={perspRefs} scrollFactor={scrollFactor} perspective />
          <ScrollAnchorRig groupRef={perspFieldRef} scrollFactor={scrollFactor} perspective />
        </>
      )}
      {flatFieldClouds.length > 0 && (
        <>
          <CloudPlacement clouds={flatFieldClouds} cloudRefs={flatRefs} scrollFactor={scrollFactor} perspective={false} />
          <ScrollAnchorRig groupRef={flatFieldRef} scrollFactor={scrollFactor} perspective={false} />
        </>
      )}
      <SectionRig clouds={sectionClouds} cloudRefs={sectionRefs} activeClouds={activeClouds} />
      <MorphRig activeClouds={activeClouds} pumpUntilVh={pumpUntilVh} />
      <InvalidateOnReady />
      <ContextWatchdog onUnrecoverable={remount} />
      {RETINT_CLOUDS && <ThemeRig ambientRef={ambientRef} keyRef={keyRef} />}
    </Canvas>
  );
}

"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import gsap from "gsap";
import {
  heavyEffectFpsCap,
  scrollRepaintFpsCap,
} from "@/lib/perf/quality-store";
import {
  burstAll,
  forEachEntry,
  getDebug,
  type FpsCap,
  type PlaneName,
  type ViewEntry,
} from "./view-registry";

const BLACK = /* @__PURE__ */ new THREE.Color(0x000000);

/**
 * Leading full-canvas clear (priority 1 — the lowest positive, so it runs before
 * every tone setter and every view render each advance). Ported verbatim from the
 * spike's ClearPass.
 *
 * WHY (spike finding #2): drei's <View> sets gl.autoClear = false and only clears
 * its own scissor region on a visibility TOGGLE, never per frame — so a
 * transparent multi-view canvas ghosts (moving content smears stale pixels). This
 * pass disables the scissor test and clears the WHOLE canvas to transparent
 * (clearAlpha 0) before any view scissors + repaints its region. Views must never
 * clear per frame themselves.
 */
export function ClearPass() {
  useFrame((state) => {
    state.gl.setScissorTest(false);
    state.gl.setClearColor(BLACK, 0);
    state.gl.clear(true, true); // color + depth
  }, 1);
  return null;
}

/** 0 (the cap fns' "uncapped" value) → Infinity; else the fps number. */
function resolveCapFps(cap: FpsCap): number {
  if (cap === null) return Infinity;
  if (typeof cap === "number") return cap;
  const v = cap === "scroll" ? scrollRepaintFpsCap() : heavyEffectFpsCap();
  return v === 0 ? Infinity : v;
}

/** A view wants paint this tick iff it's continuous, or a dirty/bursting demand. */
function wantsPaint(e: ViewEntry): boolean {
  return e.mode === "continuous" || e.dirty || e.burst > 0;
}

// Accumulator slop (ms): a naive `elapsed < budget` test on a 120 Hz ticker beats
// against the budget and lands ~44 fps, so allow a frame that's within 1 ms of due
// (matches lib/perf/capped-invalidate.ts + the testimonial/MorphRig pumps).
const TOL_MS = 1;

// Max delta (seconds) delivered to fiber on any single paint. Under
// frameloop="never" fiber computes delta = timestamp − previous elapsedTime and
// only updates elapsedTime when advance() is called — so the FIRST paint after any
// gap (mount, off-screen idle, tab-away) would otherwise deliver the WHOLE gap as
// one delta and POP delta-driven views (glass rotation, cloud morph). We pass a
// virtual clock that only steps forward by the real inter-PAINT delta clamped to
// this ceiling. 4/60 ≈ 0.0667s = the delta at 15 fps; normal caps here (30/60 fps,
// deltas 0.033/0.016s) are well under it, so only true gaps get clamped.
const MAX_DELTA = 4 / 60;

// Delayed mount-burst nudges (ms): drei geometry (Clouds' instanced build) and
// texture decode can land a few frames after mount/remount, so re-arm a 1-frame
// burst at these offsets — mirrors cloud-canvas.tsx's InvalidateOnReady insurance.
const BURST_NUDGES_MS = [100, 300, 600] as const;

/**
 * The single ticker-end advance pump for ONE plane. Generalizes the spike's Pump:
 * no private requestAnimationFrame — ONE gsap.ticker callback (the same ticker
 * LenisProvider drives) calls this canvas's advance() at most once per tick.
 * Registration is deferred one rAF past mount so it APPENDS after Lenis's ticker
 * callback (React fires child effects before ancestor effects; the rAF guarantees
 * Lenis is registered first), so views render in the SAME tick as the Lenis
 * scroll write.
 *
 * UNITS: under frameloop="never", fiber treats the advance timestamp as
 * clock.elapsedTime in SECONDS. gsap.ticker's `time` is already monotonic
 * seconds → passed straight through (NOT ×1000; the ms form is Lenis.raf's
 * contract and would corrupt MTM time + cloud morph). The cap accumulator uses
 * the same clock in ms (time × 1000).
 *
 * PAINT POLICY (idle-to-zero by construction — advance() renders unconditionally,
 * so idling is simply not calling it):
 *  1. Requesting views = visible AND wantsPaint. None → return (no advance).
 *  2. Effective rate = MAX resolved cap among requesting views (a capped view
 *     riding along with an uncapped one paints at the uncapped rate — extra
 *     paints of an unchanged scene are cheap; starving the uncapped view is not).
 *  3. Rate-limit with a remainder-carry accumulator (1 ms tolerance). Infinity →
 *     always advance.
 *  4. On a paint: clear dirty + decrement burst for every VISIBLE view (they were
 *     rendered and are now current). Off-screen dirty/bursting views keep their
 *     flags until they're visible AND painted.
 *
 * Also auto-bursts every view on visibilitychange→visible (throttled tabs drop
 * the last frame — the InvalidateOnReady tab-reshow repaint, host-wide).
 */
export function Pump({ plane }: { plane: PlaneName }) {
  const advance = useThree((s) => s.advance);

  useEffect(() => {
    const debug = getDebug(plane);
    let registered = false;
    let lastPaintMs = 0; // real gsap time (ms) of the last paint — rate limiting
    // Virtual monotonic clock (seconds) actually PASSED to advance(). It steps
    // forward only on a paint, by the real inter-paint delta clamped to MAX_DELTA,
    // so fiber never sees a gap-sized delta after mount/idle/tab-away (M3).
    let vt = 0;
    let lastPaintSec = 0; // real gsap time (s) of the last paint — for vt's delta

    // HOST-OWNED MOUNT BURST (M2): this effect lives INSIDE the Canvas, so it
    // re-runs on every ContextWatchdog key-bump remount — where a fresh context
    // emits no webglcontextrestored and the feature-side requestBurst-on-mount
    // calls (outside the Canvas) don't re-fire. Burst every view now, plus a few
    // delayed nudges for drei's multi-frame instanced-geometry build / late
    // texture decode (mirrors cloud-canvas's InvalidateOnReady). Off-screen views
    // consume the burst only once visible, so this is safe/cheap.
    burstAll(plane, 8);
    const nudges = BURST_NUDGES_MS.map((ms) => setTimeout(() => burstAll(plane, 1), ms));

    const tick = (time: number) => {
      debug.ticks++;

      // Pass 1: is anything requesting, and what's the max allowed rate?
      let anyRequesting = false;
      let effRate = 0;
      let uncapped = false;
      forEachEntry(plane, (e) => {
        if (!e.visible || !wantsPaint(e)) return;
        anyRequesting = true;
        if (uncapped) return;
        const f = resolveCapFps(e.fpsCap);
        if (f === Infinity) uncapped = true;
        else if (f > effRate) effRate = f;
      });
      if (!anyRequesting) return; // gated off → idle to zero

      // Rate limit.
      const nowMs = time * 1000;
      if (!uncapped && effRate > 0) {
        const budget = 1000 / effRate;
        if (nowMs - lastPaintMs < budget - TOL_MS) return;
        // Remainder-carry via max(last+budget, now-budget) — NOT a modulo. When
        // the tolerance admits a paint at elapsed just UNDER one budget (4 ticks
        // at 120 Hz = 33.332 ms < a 33.333 ms budget), `now − (elapsed % budget)`
        // leaves `last` unmoved and the very next tick paints again → a 30-cap
        // measured ~48 pps. max() always advances one full budget, and after a
        // long gap resyncs to now−budget instead of fast-forwarding.
        lastPaintMs = Math.max(lastPaintMs + budget, nowMs - budget);
      } else {
        lastPaintMs = nowMs;
      }

      // Step the virtual clock by the CLAMPED real inter-paint delta (M3). First
      // paint (lastPaintSec 0) steps 0. A long gap since the last paint (idle/
      // mount/tab) is clamped to MAX_DELTA, so delta-driven views advance one
      // small step instead of leaping the whole gap.
      const realDelta = lastPaintSec === 0 ? 0 : time - lastPaintSec;
      lastPaintSec = time;
      vt += Math.min(realDelta, MAX_DELTA);

      advance(vt, true);
      debug.advances++;

      // Post-paint: the whole canvas rendered, so every VISIBLE view is current.
      forEachEntry(plane, (e) => {
        if (!e.visible) return;
        e.dirty = false;
        if (e.burst > 0) e.burst--;
      });
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") burstAll(plane, 4);
    };
    document.addEventListener("visibilitychange", onVisible);

    const raf = requestAnimationFrame(() => {
      gsap.ticker.add(tick);
      registered = true;
    });

    return () => {
      cancelAnimationFrame(raf);
      if (registered) gsap.ticker.remove(tick);
      nudges.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [advance, plane]);

  return null;
}

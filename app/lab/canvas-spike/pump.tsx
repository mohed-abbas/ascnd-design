"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { spikeStats, anyVisible } from "./instrumentation";

const BLACK = /* @__PURE__ */ new THREE.Color(0x000000);

/**
 * Leading full-canvas clear (priority 1 — the lowest positive, so it runs before
 * both tone setters and both view renders each advance).
 *
 * WHY: drei's <View> sets gl.autoClear = false and only clears its own scissor
 * region on a visibility TOGGLE, never per frame (View.js). On this transparent
 * alpha canvas, moving content (the rotating glass) would otherwise smear stale
 * pixels — ghosting. This pass disables the scissor test and clears the whole
 * canvas to transparent (clearAlpha 0) before any view scissors + repaints its
 * region. This is the ghosting mitigation UNDER TEST: delete this component and
 * the rotating glass leaves trails (the HUD calls that out).
 */
export function ClearPass() {
  // Touch gl through the useFrame `state` arg (not a hook return) — matches drei's
  // View.js and satisfies react-hooks/immutability.
  useFrame((state) => {
    state.gl.setScissorTest(false);
    state.gl.setClearColor(BLACK, 0);
    state.gl.clear(true, true); // color + depth
  }, 1);
  return null;
}

/**
 * The single ticker-end advance pump. No private requestAnimationFrame: ONE
 * gsap.ticker callback (the same ticker LenisProvider drives — "one loop, no
 * competing schedulers") calls this canvas's store.advance() at most once per
 * tick. Registration is deferred one rAF past mount so it APPENDS after
 * LenisProvider's ticker callback: React fires child effects before ancestor
 * effects, so a same-tick add would land BEFORE Lenis; the rAF guarantees Lenis
 * is already registered, so the views render in the SAME tick as — and right
 * after — the Lenis scroll write.
 *
 * UNITS: frameloop="never" makes fiber's update() treat the advance timestamp as
 * clock.elapsedTime in SECONDS (delta = timestamp - clock.elapsedTime;
 * clock.elapsedTime = timestamp — events-*.esm.js update()). gsap's ticker `time`
 * is already monotonic seconds, so we pass it straight through — NOT time*1000
 * (that ms form is Lenis.raf's contract, a different one). Passing ms here would
 * silently corrupt MTM's temporal distortion and the cloud morph clock.
 *
 * IDLE-TO-ZERO: advance() renders unconditionally, so idling is simply not
 * calling it. We tick-count every frame (so ticks/s stays visible) but only
 * advance() while at least one placeholder rect intersects the viewport. Scroll
 * both views off and advance/s + paint bursts/s fall to 0 while ticks/s holds —
 * the HUD shows it. (invalidate() is a no-op under frameloop="never", so it is
 * never used anywhere in this spike; advance() is the only paint driver.)
 */
export function Pump() {
  const advance = useThree((s) => s.advance);

  useEffect(() => {
    let registered = false;
    const tick = (time: number) => {
      spikeStats.tickCount++;
      if (!anyVisible()) return; // gated off → idle to zero
      // time = gsap.ticker.time, monotonic SECONDS. First advance after mount (or
      // after an idle gap) carries a large delta — one-frame rotation/morph jump,
      // acceptable for the spike.
      advance(time, true);
      spikeStats.advanceCount++;
    };
    const raf = requestAnimationFrame(() => {
      gsap.ticker.add(tick);
      registered = true;
    });
    return () => {
      cancelAnimationFrame(raf);
      if (registered) gsap.ticker.remove(tick);
    };
  }, [advance]);

  return null;
}

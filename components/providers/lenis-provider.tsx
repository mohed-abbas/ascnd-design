"use client";

import { ReactLenis, type LenisRef } from "lenis/react";
import type Lenis from "lenis";
import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Silence the upstream `THREE.Clock` deprecation notice emitted by
// @react-three/fiber's internal store. We use no deprecated three APIs
// ourselves; R3F simply hasn't migrated to THREE.Timer yet. Patched once,
// before the (lazy) cloud canvas mounts. The window flag prevents the wrapper
// from stacking across Fast Refresh.
declare global {
  interface Window {
    __threeClockWarnSilenced?: boolean;
  }
}
if (typeof window !== "undefined" && !window.__threeClockWarnSilenced) {
  window.__threeClockWarnSilenced = true;
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("THREE.Clock")) return;
    originalWarn(...args);
  };
}

/**
 * Root smooth-scroll provider. Sets up a single global Lenis instance and the
 * industry-standard GSAP integration: Lenis drives ScrollTrigger updates, and
 * GSAP's ticker drives Lenis' rAF (one loop, no competing schedulers).
 *
 * `options.autoRaf: false` hands the rAF to GSAP. ScrollTrigger is registered
 * inside the effect so nothing touches `window` during SSR.
 */
export default function LenisProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const lenisRef = useRef<LenisRef>(null);

  // Stable options: an inline literal changes identity on every render, which
  // makes ReactLenis tear down and recreate the Lenis instance. That orphans the
  // ticker's raf onto a dead instance while the live one is never driven — so
  // nothing scrolls. Memoising keeps one instance.
  //
  // `autoRaf: false` hands the rAF to GSAP's ticker (see effect below).
  // `duration: 1.8` lengthens the scroll-smoothing time constant (Lenis default
  // is 1.2) for a heavier, more gliding feel — paired with Lenis' default
  // easeOutExpo curve, which decelerates long and soft at this duration.
  const options = useMemo(() => ({ autoRaf: false, duration: 1.8 }), []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    // On phones the URL bar collapsing/expanding during a fling fires a
    // viewport resize, and ScrollTrigger's default response is a full
    // refresh(): every trigger re-measures mid-scroll (a main-thread stall)
    // and scrubbed elements visibly snap as they re-seed. Ignore those
    // touch-device height-only resizes; real rotations/resizes still refresh.
    ScrollTrigger.config({ ignoreMobileResize: true });

    // Drive Lenis from GSAP's ticker (one loop, no competing schedulers). Read
    // the instance LAZILY every frame instead of capturing it once: the ref may
    // not be populated when this effect first runs (ReactLenis creates the
    // instance in its own effect), and if we bail or capture a stale reference,
    // Lenis never gets its raf and the page freezes. Re-bind ScrollTrigger.update
    // whenever the instance identity changes so cloud parallax stays in sync.
    let bound: Lenis | null = null;
    const update = (time: number) => {
      const lenis = lenisRef.current?.lenis;
      if (!lenis) return;
      if (bound !== lenis) {
        bound?.off("scroll", ScrollTrigger.update);
        lenis.on("scroll", ScrollTrigger.update);
        bound = lenis;
      }
      lenis.raf(time * 1000); // ms — Lenis expects the raw rAF timestamp
    };

    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(update);
      bound?.off("scroll", ScrollTrigger.update);
    };
  }, []);

  return (
    <ReactLenis root options={options} ref={lenisRef}>
      {children}
    </ReactLenis>
  );
}

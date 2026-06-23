"use client";

import { ReactLenis, type LenisRef } from "lenis/react";
import { useEffect, useRef } from "react";
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

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const lenis = lenisRef.current?.lenis;
    if (!lenis) return;

    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off("scroll", ScrollTrigger.update);
      gsap.ticker.remove(raf);
    };
  }, []);

  return (
    <ReactLenis root options={{ autoRaf: false }} ref={lenisRef}>
      {children}
    </ReactLenis>
  );
}

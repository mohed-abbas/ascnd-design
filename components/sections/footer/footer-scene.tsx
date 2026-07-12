"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useFooterGlassEligible } from "./footer-glass-config";

// The WebGL scene is client-only; ssr:false must live in a Client Component.
const FooterGlassScene = dynamic(() => import("./footer-glass-scene"), {
  ssr: false,
});

/**
 * Footer scene controller — decides what fills the footer box:
 *  - INELIGIBLE (SSR / no-JS / mobile / reduced-motion / no-WebGL): the baked-glass
 *    composite image — mountains + the glass "ascnd" flattened from the design, so
 *    these devices still get the full look, statically.
 *  - ELIGIBLE (desktop + WebGL + motion): the plain mountain cutout as an instant
 *    placeholder, plus the live liquid-glass WebGL overlay — but the canvas is
 *    DEFERRED: it only mounts once the footer comes within a viewport of the screen
 *    (IntersectionObserver). So the app's heaviest shader never creates its WebGL
 *    context at page load (where it would contend with the intro + clouds); it
 *    spins up just before you reach the bottom, then stays mounted (idle-painting
 *    off-screen via the scene's own gate).
 */
export default function FooterScene() {
  const eligible = useFooterGlassEligible();
  const [near, setNear] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!eligible || near) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      // Mount ~3 viewports early: the WebGL scene takes a few hundred ms to spin
      // up (chunk + drei build), so a 1-viewport lead let a fast scroll outrun it
      // and the reveal only played once you stopped. 3vp gives it ample runway
      // while still not creating the context at page load.
      { rootMargin: "300% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eligible, near]);

  // Ineligible (and SSR) — the baked-glass composite fills the box (its aspect
  // matches the box, so object-cover doesn't crop). Carries the brand name.
  if (!eligible) {
    return (
      <Image
        src="/footer/footer-glass-fallback.webp"
        alt="ascnd"
        fill
        sizes="100vw"
        loading="lazy"
        className="pointer-events-none select-none object-cover"
      />
    );
  }

  // Eligible — plain mountains as an instant placeholder, live glass deferred.
  return (
    <div ref={ref} className="absolute inset-0">
      {/* Placeholder / refraction twin: the mountain cutout, bottom-anchored. The
          canvas re-draws the mountains on top once it mounts, so this shows only
          until the glass spins up (and covers it). Decorative → empty alt. */}
      <Image
        src="/footer/footer-scene.webp"
        alt=""
        aria-hidden
        width={3168}
        height={1344}
        unoptimized
        loading="lazy"
        sizes="100vw"
        className="pointer-events-none absolute inset-x-0 bottom-0 block h-auto w-full select-none"
      />
      {near && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <FooterGlassScene />
        </div>
      )}
    </div>
  );
}

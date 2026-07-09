"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { useQuality } from "@/lib/perf/use-quality";

/**
 * The ring dots' slow revolve. Each ring outline is a circle (symmetric), so
 * spinning it only appears to move its dot — "the ring rotates" reads as the dot
 * travelling around the centre. Directions alternate and durations differ so no
 * two units sync. The rocks' own orbit + 3D tumble live in the GLB canvas
 * (testimonial-rocks-canvas.tsx); this only drives the DOM rings.
 *
 * Renders nothing — drives the [data-tm-ring] layers in testimonials.tsx.
 *
 * House-rules compliance (heavy-effect contract, CLAUDE.md):
 * - Rides GSAP's shared ticker (LenisProvider) — no private rAF.
 * - IDLES TO ZERO: every tween starts paused; one IntersectionObserver on the
 *   section plays them in view and pauses them out.
 * - Reads the quality tier (`testimonialsDrift`): false on low → no revolve.
 *   Reduced-motion does the same on every tier.
 * - SSR / no-JS render the resting layout; we only ADD transform, cleared on
 *   teardown.
 */

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// Per-unit revolve (index-aligned with UNITS). Seconds; directions alternate.
const RING = [
  { dur: 38, dir: 1 },
  { dur: 44, dir: -1 },
  { dur: 34, dir: 1 },
  { dur: 46, dir: -1 },
] as const;

export default function TestimonialsDrift() {
  const { testimonialsDrift } = useQuality();

  useEffect(() => {
    if (!testimonialsDrift) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const section = document.querySelector<HTMLElement>("[data-testimonials]");
    if (!section) return;
    const rings = gsap.utils.toArray<HTMLElement>("[data-tm-ring]", section);
    if (rings.length === 0) return;

    const tweens = rings.map((ring, i) => {
      const m = RING[i % RING.length];
      return gsap.to(ring, {
        rotation: 360 * m.dir,
        duration: m.dur,
        ease: "none",
        repeat: -1,
        paused: true,
      });
    });

    const io = new IntersectionObserver(
      ([entry]) => {
        const playing = entry.isIntersecting;
        for (const t of tweens) {
          if (playing) t.play();
          else t.pause();
        }
      },
      { threshold: 0 },
    );
    io.observe(section);

    return () => {
      io.disconnect();
      for (const t of tweens) t.kill();
      gsap.set(rings, { clearProps: "transform" });
    };
  }, [testimonialsDrift]);

  return null;
}

"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { useQuality } from "@/lib/perf/use-quality";

/**
 * The slow ambient motion of the testimonials rocks + rings (concept approved
 * with the ASCII storyboard). Three independent, slightly-detuned loops per
 * unit so the field drifts organically rather than marching in lockstep:
 *
 *   • ROCK — orbits its centre AND tumbles on its own axis (two clocks). The
 *     orbit is a pure translation (proxy angle → holder x/y) so it never fights
 *     the tumble; its radius eases 0 → r ONCE on first play so the rock spirals
 *     out of its resting concentric pose instead of jumping.
 *   • RING — spins in place; since the outline is a circle only the dot appears
 *     to move, so "ring rotates" reads as the dot revolving around the centre.
 *
 * Directions alternate per unit and every duration differs, so no two units
 * ever sync. Renders nothing — drives the [data-tm-*] layers in testimonials.tsx.
 *
 * House-rules compliance (heavy-effect contract, CLAUDE.md):
 * - Rides GSAP's shared ticker (LenisProvider) — no private rAF.
 * - IDLES TO ZERO: every tween starts paused; one IntersectionObserver on the
 *   section plays them in view and pauses them out, so nothing repaints at rest.
 * - Reads the quality tier (`testimonialsDrift`, lib/perf/tiers.ts): false on
 *   low → no loops, resting pose. Reduced-motion does the same on every tier.
 * - SSR / no-JS render the FINISHED (resting) layout; we only ever ADD transform
 *   on top of it, and clear what we wrote on teardown.
 */

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const DEG2RAD = Math.PI / 180;

// Per-unit detune (index-aligned with UNITS in testimonials.tsx). Durations in
// seconds — all slow; directions alternate; phases spread so nothing aligns.
const MOTION = [
  { spinDur: 48, spinDir: 1, orbitDur: 30, orbitDir: -1, orbitR: 13, orbitPhase: 0, ringDur: 38, ringDir: 1 },
  { spinDur: 54, spinDir: -1, orbitDur: 34, orbitDir: 1, orbitR: 14, orbitPhase: 130, ringDur: 44, ringDir: -1 },
  { spinDur: 44, spinDir: 1, orbitDur: 26, orbitDir: -1, orbitR: 8, orbitPhase: 220, ringDur: 34, ringDir: 1 },
  { spinDur: 58, spinDir: -1, orbitDur: 32, orbitDir: 1, orbitR: 9, orbitPhase: 310, ringDur: 46, ringDir: -1 },
] as const;

export default function TestimonialsDrift() {
  const { testimonialsDrift } = useQuality();

  useEffect(() => {
    if (!testimonialsDrift) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const section = document.querySelector<HTMLElement>("[data-testimonials]");
    if (!section) return;
    const units = gsap.utils.toArray<HTMLElement>("[data-tm-unit]", section);
    if (units.length === 0) return;

    const tweens: gsap.core.Tween[] = [];

    units.forEach((unit, i) => {
      const m = MOTION[i % MOTION.length];
      const ring = unit.querySelector<HTMLElement>("[data-tm-ring]");
      const holder = unit.querySelector<HTMLElement>("[data-tm-holder]");
      const spin = unit.querySelector<HTMLElement>("[data-tm-spin]");

      // Ring dot revolves about the centre (the circle outline is symmetric).
      if (ring) {
        tweens.push(
          gsap.to(ring, {
            rotation: 360 * m.ringDir,
            duration: m.ringDur,
            ease: "none",
            repeat: -1,
            paused: true,
          }),
        );
      }

      // Rock tumbles — on top of the resting Figma angle (baked into the box's
      // CSS transform), so this rotation adds to it.
      if (spin) {
        tweens.push(
          gsap.to(spin, {
            rotation: 360 * m.spinDir,
            duration: m.spinDur,
            ease: "none",
            repeat: -1,
            paused: true,
          }),
        );
      }

      // Rock orbits — proxy angle → holder x/y (pure translation). Radius eases
      // 0 → orbitR once so the rock spirals out of its concentric rest, no jump.
      if (holder) {
        const p = { ang: m.orbitPhase, rad: 0 };
        tweens.push(
          gsap.to(p, {
            rad: m.orbitR,
            duration: 1.6,
            ease: "power2.out",
            paused: true,
            overwrite: false,
          }),
          gsap.to(p, {
            ang: m.orbitPhase + 360 * m.orbitDir,
            duration: m.orbitDur,
            ease: "none",
            repeat: -1,
            paused: true,
            overwrite: false,
            onUpdate: () => {
              const a = p.ang * DEG2RAD;
              gsap.set(holder, { x: Math.cos(a) * p.rad, y: Math.sin(a) * p.rad });
            },
          }),
        );
      }
    });

    // One gate for the whole section: play in view, pause out — idle to zero.
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
      // Drop the transforms we wrote so the resting Figma pose returns.
      const moved = gsap.utils.toArray<HTMLElement>(
        "[data-tm-ring], [data-tm-holder], [data-tm-spin]",
        section,
      );
      gsap.set(moved, { clearProps: "transform" });
    };
  }, [testimonialsDrift]);

  return null;
}

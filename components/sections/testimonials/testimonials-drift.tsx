"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { REVEAL, UNITS } from "./testimonials-data";
import {
  isTestimonialsRevealPlayed,
  onTestimonialsRevealPlay,
  onTestimonialsRevealReset,
} from "./testimonials-reveal";

/**
 * The DOM rings: their replayable REVEAL and their ongoing dot revolve.
 *
 * Reveal — the rings are parked hidden; every PLAY (section ~half in view,
 * either direction) draws each ring in the instant its rock lands (timed off
 * the shared REVEAL constants, so it stays in lockstep with the canvas), and
 * every RESET (section fully left) re-hides them for the next pass.
 *
 * Revolve — each ring outline is a circle (symmetric), so spinning it only
 * appears to move its dot — "the ring rotates" reads as the dot travelling
 * around the centre. Directions alternate and durations differ so no two units
 * sync. On desktop the rocks' own fly-in + orbit + 3D tumble live in the GLB
 * canvas (testimonial-rocks-canvas.tsx). On MOBILE (flat PNG rocks, no canvas)
 * this driver reproduces the entrance in the DOM: each rock FLIES IN from
 * off-screen along its outward direction, landing just before its ring draws in
 * (shared REVEAL timing), and also spins in the OPPOSITE direction of its ring so
 * the two counter-rotate (see FLY_DIST / ROCK_DUR and the fly/rock tweens below).
 *
 * Renders nothing — drives the [data-tm-ring] layers in testimonials.tsx and,
 * on mobile, the [data-tm-rock] / [data-tm-fly] layers in testimonial-rocks.tsx.
 *
 * ⚠️ Deliberately NOT gated on the quality tier (feature-first, CLAUDE.md) —
 * the tier can step down mid-session and must never change this section's
 * behaviour under the user. Reduced-motion still renders the resting layout.
 *
 * House-rules compliance (heavy-effect contract, CLAUDE.md):
 * - Rides GSAP's shared ticker (LenisProvider) — no private rAF.
 * - IDLES TO ZERO: every revolve tween starts paused; one IntersectionObserver
 *   on the section plays them in view and pauses them out.
 * - SSR / no-JS render the resting layout; we only ADD transform/opacity,
 *   cleared on teardown.
 */

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// Per-unit revolve (index-aligned with UNITS). Seconds; directions alternate.
const RING = [
  { dur: 38, dir: 1 },
  { dur: 44, dir: -1 },
  { dur: 34, dir: 1 },
  { dur: 46, dir: -1 },
] as const;

// Per-unit rock spin (index-aligned with UNITS/RING), seconds. MOBILE ONLY by
// construction: the flat PNG rocks are the only [data-tm-rock] in the DOM — on
// desktop the rocks tumble in the 3D canvas and this selector finds nothing. Each
// rock spins in the OPPOSITE direction of its own ring (dir = −RING[i].dir), a
// touch slower, so the rock and its orbit outline visibly counter-rotate.
const ROCK_DUR = [58, 64, 50, 68] as const;

// Mobile rock fly-in: each PNG rock enters from OFF-SCREEN along its own outward
// direction (toward its corner), landing at rest just before its ring draws in —
// the DOM counterpart of the desktop canvas fly-in, on the same shared REVEAL
// timing (flyDur/flyDelay/flyEase → ringDelay). FLY_DIST is a plain-px offset on
// the unscaled outer wrapper, large enough to clear any ≤768px viewport. The
// outward sign per unit comes from its mobile centre (mx/my vs the 50% midline).
const FLY_DIST = 1000;
const flyOffset = (i: number) => ({
  x: (parseFloat(UNITS[i].mx) < 50 ? -1 : 1) * FLY_DIST,
  y: (parseFloat(UNITS[i].my) < 50 ? -1 : 1) * FLY_DIST,
});

export default function TestimonialsDrift() {
  useEffect(() => {
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const section = document.querySelector<HTMLElement>("[data-testimonials]");
    if (!section) return;
    const rings = gsap.utils.toArray<HTMLElement>("[data-tm-ring]", section);
    if (rings.length === 0) return;
    // Empty on desktop (3D canvas rocks, no [data-tm-rock]); populated on mobile.
    const rocks = gsap.utils.toArray<HTMLElement>("[data-tm-rock]", section);
    // Fly-in wrappers — mobile only (the desktop canvas owns its own fly-in, so
    // we skip the DOM fly there even on a non-WebGL desktop fallback).
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const flyers = isMobile
      ? gsap.utils.toArray<HTMLElement>("[data-tm-fly]", section)
      : [];

    // Park the rings hidden up front (the section is off-screen on load, so no
    // flash); every PLAY draws them in, every RESET re-parks them. If the reveal
    // already played (this driver remounted mid-view), start them shown.
    const HIDDEN = { opacity: 0, scale: 0.6 };
    gsap.set(rings, isTestimonialsRevealPlayed() ? { opacity: 1, scale: 1 } : HIDDEN);
    // Same for the rocks: parked off-screen until the entrance plays.
    flyers.forEach((f, i) =>
      gsap.set(f, isTestimonialsRevealPlayed() ? { x: 0, y: 0 } : flyOffset(i)),
    );

    let revealTweens: gsap.core.Tween[] = [];
    const killReveal = () => {
      for (const t of revealTweens) t.kill();
      revealTweens = [];
    };
    const unPlay = onTestimonialsRevealPlay(() => {
      killReveal();
      // Rocks fly home first (mobile only)...
      flyers.forEach((f, i) => {
        revealTweens.push(
          gsap.fromTo(f, flyOffset(i), {
            x: 0,
            y: 0,
            duration: REVEAL.flyDur,
            delay: REVEAL.flyDelay(i),
            ease: REVEAL.flyEase,
          }),
        );
      });
      // ...then each ring draws in the instant its rock lands (REVEAL.ringDelay).
      rings.forEach((ring, i) => {
        revealTweens.push(
          gsap.fromTo(ring, HIDDEN, {
            opacity: 1,
            scale: 1,
            duration: REVEAL.ringDur,
            delay: REVEAL.ringDelay(i),
            ease: REVEAL.ringEase,
          }),
        );
      });
    });
    const unReset = onTestimonialsRevealReset(() => {
      killReveal();
      gsap.set(rings, HIDDEN);
      flyers.forEach((f, i) => gsap.set(f, flyOffset(i)));
    });

    // Rotation vs scale/opacity are independent transform props, so the revolve
    // and the reveal compose without fighting.
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

    // Rock counter-spin (mobile only — see ROCK_DUR). `+=` preserves each rock's
    // resting orientation (its inline rotate()); the mobile scale rides the outer
    // wrapper, so rotating this inner element composes cleanly. Same paused +
    // IntersectionObserver idle-to-zero contract as the ring revolves.
    const rockTweens = rocks.map((rock, i) => {
      const dir = -RING[i % RING.length].dir; // opposite its own ring
      return gsap.to(rock, {
        rotation: `+=${360 * dir}`,
        duration: ROCK_DUR[i % ROCK_DUR.length],
        ease: "none",
        repeat: -1,
        paused: true,
      });
    });

    const spinTweens = [...tweens, ...rockTweens];
    const io = new IntersectionObserver(
      ([entry]) => {
        const playing = entry.isIntersecting;
        for (const t of spinTweens) {
          if (playing) t.play();
          else t.pause();
        }
      },
      { threshold: 0 },
    );
    io.observe(section);

    return () => {
      unPlay();
      unReset();
      io.disconnect();
      killReveal();
      for (const t of spinTweens) t.kill();
      gsap.set(rings, { clearProps: "transform,opacity" });
      if (flyers.length) gsap.set(flyers, { clearProps: "transform" });
    };
  }, []);

  return null;
}

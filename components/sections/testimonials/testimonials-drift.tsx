"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { REVEAL } from "./testimonials-data";
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
 * sync. The rocks' own fly-in + orbit + 3D tumble live in the GLB canvas
 * (testimonial-rocks-canvas.tsx); this only drives the DOM rings.
 *
 * Renders nothing — drives the [data-tm-ring] layers in testimonials.tsx.
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

export default function TestimonialsDrift() {
  useEffect(() => {
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const section = document.querySelector<HTMLElement>("[data-testimonials]");
    if (!section) return;
    const rings = gsap.utils.toArray<HTMLElement>("[data-tm-ring]", section);
    if (rings.length === 0) return;

    // Park the rings hidden up front (the section is off-screen on load, so no
    // flash); every PLAY draws them in, every RESET re-parks them. If the reveal
    // already played (this driver remounted mid-view), start them shown.
    const HIDDEN = { opacity: 0, scale: 0.6 };
    gsap.set(rings, isTestimonialsRevealPlayed() ? { opacity: 1, scale: 1 } : HIDDEN);

    let revealTweens: gsap.core.Tween[] = [];
    const killReveal = () => {
      for (const t of revealTweens) t.kill();
      revealTweens = [];
    };
    const unPlay = onTestimonialsRevealPlay(() => {
      killReveal();
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
      unPlay();
      unReset();
      io.disconnect();
      killReveal();
      for (const t of tweens) t.kill();
      gsap.set(rings, { clearProps: "transform,opacity" });
    };
  }, []);

  return null;
}

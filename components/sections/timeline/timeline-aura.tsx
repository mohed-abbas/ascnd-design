"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { AURA, GLOW_OPACITY, RING_MASK, SWEEP_DURATION } from "@/components/ui/aura";

/**
 * The always-on rainbow aura for the timeline's task chips (UI/UX, 70%
 * completed) — the same siri-style rainbow the CTA button wears, matched to the
 * chips' small scale. "creating your board" uses the real <Button aura="always">;
 * the chips are too small to be buttons, so this renders the identical aura
 * (aura.ts's AURA gradient + RING_MASK) as an overlay.
 *
 * Reliability note: the conic gradient is applied DIRECTLY to each layer (so it
 * auto-centres on the element) and orbited by driving `--aura-angle` — the same
 * technique as components/ui/button.tsx. (An earlier rotor version mis-centred
 * the gradient and smeared the colour to one edge.)
 *
 * House rules: rides GSAP's shared ticker (no private rAF); an IntersectionObserver
 * pauses the orbit off-screen so nothing repaints at rest (idle to zero); reduced
 * motion holds a static rainbow. SSR-safe — the layers render server-side
 * (--aura-angle defaults to 0), only the orbit is client-driven.
 *
 * Drop inside a `relative` element that isn't clipped (overflow-visible). Sizes
 * are `cqw` strings so the aura scales with the composition; `radius` matches the
 * element's corner radius, `ring` the rim width, `spread`/`blur` the outer bloom.
 */
export default function TimelineAura({
  radius,
  ring = "0.12cqw",
  spread = "0.26cqw",
  blur = "0.4cqw",
  glowOpacity = GLOW_OPACITY,
}: {
  radius: string;
  ring?: string;
  spread?: string;
  blur?: string;
  glowOpacity?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Orbit the conic by sweeping its from-angle, paused until on-screen.
    const angle = { v: 0 };
    const sweep = gsap.to(angle, {
      v: 360,
      duration: SWEEP_DURATION,
      ease: "none",
      repeat: -1,
      paused: true,
      onUpdate: () => wrap.style.setProperty("--aura-angle", String(angle.v)),
    });
    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? sweep.play() : sweep.pause()),
      { threshold: 0 },
    );
    io.observe(wrap);

    return () => {
      io.disconnect();
      sweep.kill();
    };
  }, []);

  return (
    <div ref={wrapRef} aria-hidden className="pointer-events-none absolute inset-0">
      {/* Soft rainbow bloom hugging the rim — a blurred masked ring. */}
      <span
        className="absolute block"
        style={{ inset: `calc(${spread} * -1)`, filter: `blur(${blur})`, opacity: glowOpacity }}
      >
        <span
          className="absolute inset-0 block"
          style={{ borderRadius: radius, padding: ring, background: AURA, ...RING_MASK }}
        />
      </span>
      {/* Crisp rainbow ring on the rim (auto-centred conic, masked to a band). */}
      <span
        className="absolute block"
        style={{
          inset: `calc(${ring} * -1)`,
          borderRadius: radius,
          padding: ring,
          background: AURA,
          ...RING_MASK,
        }}
      />
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { AURA, RING_MASK, SWEEP_DURATION } from "@/components/ui/aura";
import { useQuality } from "@/lib/perf/use-quality";

/**
 * The featured "ascnd" column's highlight panel (Figma node 469:554) with the
 * same siri-style rainbow aura the CTA button shows on hover (see
 * components/ui/button.tsx / aura.ts) — here it's the column's permanent
 * emphasis rather than a hover accent.
 *
 * Three deltas from the button's aura:
 *  1. Gated on IN-VIEW, not hover: the orbit runs only while the comparison
 *     section is on-screen and pauses off-screen, so no per-frame paint happens
 *     at rest (idle to zero — heavy-effect contract, CLAUDE.md).
 *  2. The column fill is TRANSLUCENT (glass), so a filled glow blob behind it
 *     would flood the interior with rainbow (the exact reason the glass button
 *     has no aura). Instead the glow is a BLURRED edge-ring — a soft rainbow
 *     bloom that hugs the border and never washes the interior.
 *  3. FULL CARD HEIGHT (edge to edge, matching the table), which only works
 *     because the card drops overflow-clip (see comparison.tsx): a clip would
 *     chop the top/bottom border + glow while the sides bloomed freely — a
 *     broken loop. Unclipped, the ring blooms past all four edges as one
 *     continuous glowing loop. The 1.5px overshoot top/bottom keeps the glow
 *     symmetric with the sides.
 *
 * Tiering: `comparisonAuraSweep` (lib/perf/tiers.ts) holds the orbit STATIC on
 * the low tier (a fixed-angle rainbow, no repaint); reduced-motion does the same
 * regardless of tier. Rides GSAP's shared ticker (no private rAF). Layer order
 * mirrors the button: glow → fill → ring. SSR renders a valid static rainbow
 * (--aura-angle defaults to 0), so there's no hydration branch.
 */

// The original static-panel fill (node 469:554): a faint top→bottom glass sheen.
const FILL_GRADIENT =
  "linear-gradient(169.6deg, rgba(255,255,255,0.2) 1.55%, rgba(255,255,255,0.06) 97%)";

export default function AscndAura() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { comparisonAuraSweep } = useQuality();

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    // Low tier / reduced motion → static rainbow, no per-frame orbit.
    if (!comparisonAuraSweep) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Orbit the conic gradient by driving --aura-angle 0→360 (inherited by the
    // glow + ring off this wrapper). Paused until the section is on-screen, so
    // nothing animates at rest. Rides GSAP's shared ticker (LenisProvider).
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
      { threshold: 0 }
    );
    io.observe(wrap);

    return () => {
      io.disconnect();
      sweep.kill();
    };
  }, [comparisonAuraSweep]);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none absolute -bottom-[1.5px] -top-[1.5px] left-[303.5px] z-0 w-[173px]"
    >
      {/* Soft rainbow bloom hugging the border (the glow) — a masked edge-ring
          blurred by its PARENT (filter runs before mask on one element, which
          would hard-clip the blur; blurring the parent lets the ring bloom).
          Being a ring, not a blob, it never floods the translucent interior. */}
      <span
        className="absolute -inset-[4px]"
        style={{ filter: "blur(8px)", opacity: 0.6 }}
      >
        <span
          className="absolute inset-0 rounded-[24px]"
          style={{ padding: "5px", background: AURA, ...RING_MASK }}
        />
      </span>
      {/* Translucent glass fill + a faint base edge (the original panel look). */}
      <span
        className="absolute inset-0 rounded-[20px] border border-solid border-white/40"
        style={{ backgroundImage: FILL_GRADIENT }}
      />
      {/* Crisp rainbow ring on the 2px edge. */}
      <span
        className="absolute inset-0 rounded-[20px]"
        style={{ padding: "2px", background: AURA, ...RING_MASK }}
      />
    </div>
  );
}

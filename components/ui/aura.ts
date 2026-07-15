import type { CSSProperties } from "react";

/**
 * The shared "siri-style" rainbow aura — a conic gradient whose colour ORBITS
 * the rim of an element, driven per-frame by the `--aura-angle` CSS variable
 * (degrees) set on an ancestor. Shared by:
 *   • the CTA button's hover ring (components/ui/button.tsx), and
 *   • the comparison section's featured-column glow
 *     (components/sections/comparison/ascnd-aura.tsx),
 * so both render literally the same rainbow.
 *
 * The angle is animated 0→360 by a GSAP tween on the SHARED ticker (never a
 * private rAF) and gated to idle to zero — hover for the button, in-view for the
 * column — per the heavy-effect contract in CLAUDE.md.
 */

// Conic gradient with matched endpoints (#5ea8ff → #5ea8ff) so a full revolution
// has no seam. Fallback 0 keeps SSR / first paint valid before JS sets the angle.
export const AURA =
  "conic-gradient(from calc(var(--aura-angle, 0) * 1deg), #5ea8ff, #a06bff, #ff6ec7, #ff9d5c, #ffe36e, #5ef2c8, #5ea8ff)";

// Seconds per full revolution of the aura around the rim (continuous orbit).
export const SWEEP_DURATION = 2.6;

// Hover glow strength for the button aura. Kept moderate so the soft glow reads
// as a colour halo, not a bright wash around the rim (the glow is re-saturated
// after its blur in button.tsx — see the note there).
export const GLOW_OPACITY = 0.5;

// Border-only mask — XOR of a content-box fill against a full fill leaves only
// the `padding`-width edge, turning a filled gradient layer into a ring. Both
// the -webkit- and standard properties are set for cross-browser support.
export const RING_MASK: CSSProperties = {
  WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor",
  mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  maskComposite: "exclude",
};

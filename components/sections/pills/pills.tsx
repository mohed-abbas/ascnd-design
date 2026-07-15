import type { CSSProperties } from "react";
import Button from "@/components/ui/button";
import PillsFlow from "./pills-flow";
import PillsHeading from "./pills-heading";
import { PILLS } from "./pills-data";

/**
 * "everything that gets you up there" — Figma frame "SectionPills" (node
 * 371:8260, "capabilities" 371:8375 at 1319×977).
 *
 * A field of ~20 glass capability pills scattered around a centred headline +
 * "see plans" CTA. Like the hero and cards, it renders at DESIGN SCALE (fixed
 * px, centre-anchored) and stays TRANSPARENT over the shared sky: the Figma
 * mockup paints its own #62abff fill + grain, but in this app that's the global
 * fixed <Background/> mounted in layout.tsx, so scrolling into here stays in one
 * continuous world (no double grain).
 *
 * The pills fade toward the edges. In Figma that's a baked alpha mask image on
 * the Pills group; here it's a CSS radial-gradient mask instead — resolution-
 * independent and easy to retune, and it reads identically (dense/clear around
 * the headline, dissolving into the sky at the rim). The gradient is centred on
 * the FRAME centre, which is ~(51%, 54%) within the offset Pills box.
 *
 * Each pill is the house frosted-glass capsule (same recipe as card-shell.tsx):
 * a faint top→bottom dark fill, a light backdrop blur, and a 1.5px white edge at
 * ~30% opacity — NOT the opaque `border-white` that get_design_context reports.
 * The Figma stroke is semi-transparent (measured ~0.1–0.3 white over the sky on
 * the rendered node); the MCP flattens stroke opacity, so it reads as solid.
 * border-white/30 matches the navbar/cards house style and the glassy look.
 *
 * Font mapping (matches tagline.tsx): the design sets the middle line in Product
 * Sans BLACK, but only Light/Regular/Medium/Bold are self-hosted (app/fonts), so
 * it uses Bold (700) — the heaviest available. "everything" is Instrument Serif
 * (font-instrument), "there" is Product Sans Light (font-light).
 *
 * Static layout only — the scroll/hover animation is deferred to a future
 * pills-reveal.tsx driver, same split as the other sections.
 */

export default function Pills() {
  return (
    <section
      data-pills
      className="relative min-h-dvh w-full overflow-hidden"
    >
      {/* Slow upward drift + a random per-pill fade in/out twinkle, so pills
          materialise and vanish anywhere in the field (see pills-flow.tsx).
          Renders nothing. */}
      <PillsFlow />

      {/* The 1319×977 "capabilities" frame, centre-anchored (design scale). */}
      <div className="absolute left-1/2 top-1/2 h-[977px] w-[1319px] -translate-x-1/2 -translate-y-1/2">
        {/* Pill field — the 1258×876 "Pills" box at (13,17), radial-masked.
            overflow-hidden clips the rising pills so their wrap (pills-flow.tsx)
            happens off-screen and reads as a seamless upward stream. */}
        <div
          aria-hidden
          className="pill-field-mask absolute left-[13px] top-[17px] h-[876px] w-[1258px] overflow-hidden"
        >
          {PILLS.map((p) => (
            <div
              key={p.id}
              data-pill
              data-node-id={p.id}
              className="absolute flex h-[42px] items-center rounded-[20px] border-[1.5px] border-solid border-white/30 bg-gradient-to-b from-black/10 to-black/5 px-[15px] backdrop-blur-[2px] will-change-transform left-[var(--dl)] top-[var(--dt)] max-md:left-[var(--ml)] max-md:top-[var(--mt)]"
              // Desktop uses the design scatter (--dl/--dt); below md it switches
              // to the compact, provably non-overlapping layout (--ml/--mt) — see
              // pills-data.ts. Positions live in CSS vars so the switch is a pure
              // media query (Tailwind max-md:) with no JS.
              style={
                {
                  "--dl": `${p.left}px`,
                  "--dt": `${p.top}px`,
                  "--ml": `${p.mobileLeft}px`,
                  "--mt": `${p.mobileTop}px`,
                } as CSSProperties
              }
            >
              <span
                className={`whitespace-nowrap text-[20px] leading-[1.1] tracking-[-0.6px] text-white ${
                  p.lower ? "lowercase" : ""
                }`}
              >
                {p.label}
              </span>
            </div>
          ))}
        </div>

        {/* Centre column: staggered mixed-font headline + CTA (Figma 371:8419). */}
        <div className="absolute left-1/2 top-[339px] flex w-[475px] -translate-x-1/2 flex-col items-center gap-[32px]">
          {/* Word-by-word blur reveal on scroll-in (see pills-heading.tsx). */}
          <PillsHeading />

          {/* Primary CTA — the site's shared solid Button (white gradient +
              hover aura), exactly the surface this "see plans" node describes. */}
          <Button variant="solid">see plans</Button>
        </div>
      </div>
    </section>
  );
}

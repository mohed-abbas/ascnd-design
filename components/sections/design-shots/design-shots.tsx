import Image from "next/image";
import { SHOT_BASE, SHOT_FRAME_RADIUS, SHOT_MAT_RATIO, SHOTS } from "./shots-spec";

// Glass mat metrics, authored at the BASE box (the rotor's transform scales the
// whole tile — border, glow and radius included — down to each slot's size, so
// the frame stays in proportion as a tile grows into the centre and shrinks out).
// The shot keeps its full slot size; the frame wraps AROUND it as an outer border
// (extended outward by the mat), so the shot never shrinks.
const MAT_PAD = SHOT_MAT_RATIO * SHOT_BASE; // px the frame extends beyond the shot
// The shot shares the frame's corner radius, so the screenshot rounds to match
// the glass border instead of staying near-square. Both authored at BASE; the
// rotor transform scales them down together.
const FRAME_RADIUS = SHOT_FRAME_RADIUS;
const IMAGE_RADIUS = SHOT_FRAME_RADIUS;
// Inset white sheen — the navbar "menu" glass signature, scaled to the tile: the
// navbar's 28.3px glow is 2.44% of its width, so at BASE that's ~6.4px, which
// fills the mat ring so the whole frame reads as lit glass.
const FRAME_GLOW = `inset 0 0 ${MAT_PAD}px 0 rgba(255,255,255,0.28)`;

/**
 * "Designs Shots" collage — Figma node 348:1498. The DOM renderer, used as the
 * FALLBACK: it shows for ineligible/returning sessions and whenever the welcome
 * intro doesn't drive the WebGL scene. Seven floating tiles fanned symmetrically
 * around the hero's horizontal center (largest in the middle, shrinking and
 * rising toward both edges).
 *
 * Each tile is a GLASS-MATTED FRAME (Figma 357:7072), not a bare image: a thin
 * liquid-glass mat — styled like the navbar "menu" glass (white/30 edge, white/10
 * fill, inset white sheen) — wraps the shot as an OUTER border (extended outward
 * so the shot keeps its full slot size). Corner radius + mat width are constant
 * fractions of the edge (shots-spec.ts), so they hold at every slot. The shot is
 * served `unoptimized` (raw PNG, browser-scaled) so the fine
 * mockup text stays razor-sharp — Next's AVIF/WebP re-encode softened it (same
 * reason the receive card opts out).
 *
 * Layout: a fixed BASE-sized square at the collage center, placed at its slot by
 * an inline `transform: translate(x,y) scale(size/BASE)` on the outer "rotor".
 * Rendering at BASE and scaling *down* keeps every tile crisp at the big center
 * slot it visits during the rotation (design-shots-reveal.tsx); the inline
 * transform is also the no-JS / reduced-motion resting layout, so there's no
 * flash. The inner `data-shot` element carries only the on-load bloom (scale +
 * opacity), kept separate so the two transforms never fight. Order/identity/arc
 * come from the shared spec (shots-spec.ts), so this and the WebGL scene line up
 * by construction.
 */
export default function DesignShots() {
  return (
    <div className="relative size-full" aria-hidden>
      {SHOTS.map((tile) => (
        <div
          key={tile.arc}
          data-shot-rotor
          data-arc={tile.arc}
          className="absolute left-1/2 top-1/2"
          style={{
            width: SHOT_BASE,
            height: SHOT_BASE,
            marginLeft: -SHOT_BASE / 2,
            marginTop: -SHOT_BASE / 2,
            transform: `translate(${tile.x}px, ${tile.y}px) scale(${tile.size / SHOT_BASE})`,
          }}
        >
          {/* Bloom wrapper — on-load scale + opacity only (design-shots-reveal). */}
          <div data-shot data-shot-ring={tile.ring} className="size-full">
            <div className={`size-full ${tile.mirror ? "-scale-x-100" : ""}`}>
              <div className="relative size-full">
                {/* Liquid-glass mat frame (menu style) — an OUTER border wrapping
                    the shot, extended outward by the mat so the shot stays full. */}
                <div
                  aria-hidden
                  className="absolute border border-white/40 bg-white/10"
                  style={{
                    inset: -MAT_PAD,
                    borderRadius: FRAME_RADIUS,
                    boxShadow: FRAME_GLOW,
                  }}
                />
                {/* Full-size, rounded shot (sits on top of the frame). */}
                <div
                  className="relative size-full overflow-hidden bg-white"
                  style={{ borderRadius: IMAGE_RADIUS }}
                >
                  <Image
                    src={tile.src}
                    alt={tile.alt}
                    fill
                    sizes={`${SHOT_BASE}px`}
                    priority={tile.priority}
                    // Raw PNG, browser-scaled — keeps the mockup text crisp (Next's
                    // re-encode softens it); the sources are pre-sized to ~1024².
                    unoptimized
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

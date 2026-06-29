import Image from "next/image";
import { SHOT_BASE, SHOTS } from "./shots-spec";

/**
 * "Designs Shots" collage — Figma node 103:30. The DOM renderer, used as the
 * FALLBACK: it shows for ineligible/returning sessions and whenever the welcome
 * intro doesn't drive the WebGL scene. Seven floating tiles fanned symmetrically
 * around the hero's horizontal center (largest in the middle, shrinking and
 * rising toward both edges); left-side tiles are mirrored.
 *
 * Each tile is laid out as a fixed BASE-sized square at the collage center and
 * placed at its slot by an inline `transform: translate(x,y) scale(size/BASE)`
 * on the outer "rotor". Rendering at BASE and scaling *down* keeps every tile
 * crisp at the big center slot it visits during the rotation (design-shots-
 * reveal.tsx); the inline transform is also the no-JS / reduced-motion resting
 * layout, so there's no flash. The inner `data-shot` element carries only the
 * on-load bloom (scale + opacity), kept separate so the two transforms never
 * fight. Order/identity/arc come from the shared spec (shots-spec.ts), so this
 * and the WebGL scene line up by construction.
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
              <div
                className="relative size-full overflow-hidden bg-white"
                // Radius is authored at the tile's resting size; scaled up to the
                // BASE box so it tracks the tile's scale (corners stay in ratio).
                style={{ borderRadius: (tile.radius / tile.size) * SHOT_BASE }}
              >
                <Image
                  src={tile.src}
                  alt={tile.alt}
                  fill
                  sizes={`${SHOT_BASE}px`}
                  priority={tile.priority}
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

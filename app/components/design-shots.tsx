import Image from "next/image";

/**
 * "Designs Shots" collage — Figma node 103:30.
 * Seven floating tiles fanned symmetrically around the hero's horizontal
 * center: largest in the middle, shrinking and rising toward both edges.
 * Left-side tiles are horizontally mirrored, exactly as in the design.
 *
 * Each tile is laid out as a fixed BASE-sized square at the collage center and
 * placed at its slot by an inline `transform: translate(x,y) scale(size/BASE)`
 * on the outer "rotor". Rendering at BASE and scaling *down* keeps every tile
 * crisp at the big center slot it visits during the rotation (design-shots-
 * reveal.tsx); the inline transform is also the no-JS / reduced-motion resting
 * layout, so there's no flash. The inner `data-shot` element carries only the
 * on-load bloom (scale + opacity), kept separate so the two transforms never
 * fight.
 */

// Render box for every tile = the largest (center) slot, so scaling is always
// ≤1 and the source never has to be upscaled.
export const SHOT_BASE = 261;

// The loop the rotation rides (size belongs to the slot, not the tile). Slots
// 0..6 are the seven *visible* arc positions (far-L → far-R). Slot 7 is an
// off-screen RETURN position above the frame: a true conveyor needs one more
// slot than the visible count so that a tile can travel hidden from far-R back
// to far-L while all seven visible slots stay filled (no gap). The path
// far-R(6) → return(7) → far-L(0) arcs up and over, off-screen, so the wrap is
// never seen — it just disappears past far-R and reappears at far-L.
export const SHOT_ARC_SLOTS: { x: number; y: number; size: number }[] = [
  { x: -476.5, y: -207.5, size: 76 }, // 0 far-L
  { x: -404, y: -74, size: 117 }, //     1 mid-L
  { x: -253.5, y: 50.5, size: 158 }, //  2 inner-L
  { x: 0, y: 115, size: 261 }, //        3 center
  { x: 253.5, y: 50.5, size: 158 }, //   4 inner-R
  { x: 404, y: -74, size: 117 }, //      5 mid-R
  { x: 476.5, y: -207.5, size: 76 }, //  6 far-R
  { x: 0, y: -480, size: 60 }, //        7 return (off-screen, above the frame)
];

type Tile = {
  src: string;
  /** square box size in px (the slot it rests in) */
  size: number;
  /** corner radius in px at its resting size */
  radius: number;
  /** horizontal offset from center (px, negative = left) */
  x: number;
  /** vertical offset from center (px, negative = up) */
  y: number;
  /** mirror horizontally (left-side tiles) — fixed per tile, never flips */
  mirror?: boolean;
  /** eager-load (largest above-the-fold tile, LCP candidate) */
  priority?: boolean;
  /** ring out from the center (0 = center) — drives the bloom stagger order */
  ring: number;
  /** index into SHOT_ARC_SLOTS — the tile's resting slot / rotation phase */
  arc: number;
  alt: string;
};

const TILES: Tile[] = [
  { src: "/shots/shot2.png", size: 261, radius: 15, x: 0, y: 115, ring: 0, arc: 3, priority: true, alt: "" }, // center
  { src: "/shots/shot3.png", size: 158, radius: 10, x: 253.5, y: 50.5, ring: 1, arc: 4, alt: "" }, // inner right
  { src: "/shots/shot6.png", size: 158, radius: 20, x: -253.5, y: 50.5, ring: 1, arc: 2, mirror: true, alt: "" }, // inner left
  { src: "/shots/shot4.png", size: 117, radius: 7, x: 404, y: -74, ring: 2, arc: 5, alt: "" }, // mid right
  { src: "/shots/shot7.png", size: 117, radius: 7, x: -404, y: -74, ring: 2, arc: 1, mirror: true, alt: "" }, // mid left
  { src: "/shots/shot5.png", size: 76, radius: 5, x: 476.5, y: -207.5, ring: 3, arc: 6, alt: "" }, // far right
  { src: "/shots/shot8.png", size: 76, radius: 5, x: -476.5, y: -207.5, ring: 3, arc: 0, mirror: true, alt: "" }, // far left
  // 8th tile — the conveyor's in-transit slot, which is off-screen on the
  // return path almost the whole time (only ever briefly grazing the far
  // corners as it fades out past far-R / fades in before far-L). It reuses the
  // center image and sits 4 slots (half the loop) from its twin, so whenever
  // one copy is at the prominent center the other is parked on the hidden
  // return — the two are never both prominent. Its resting transform is the
  // off-screen return slot; the rotation places it each frame. radius/size keep
  // the center tile's corner ratio.
  { src: "/shots/shot2.png", size: 60, radius: 3.5, x: 0, y: -480, ring: 0, arc: 7, alt: "" }, // return (hidden)
];

export default function DesignShots() {
  return (
    <div className="relative size-full" aria-hidden>
      {TILES.map((tile) => (
        <div
          key={tile.src}
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

import Image from "next/image";

/**
 * "Designs Shots" collage — Figma node 103:30.
 * Seven floating tiles fanned symmetrically around the hero's horizontal
 * center: largest in the middle, shrinking and rising toward both edges.
 * Left-side tiles are horizontally mirrored, exactly as in the design.
 *
 * Offsets are px relative to the collage center (= hero center), matching
 * the Figma `left/top: calc(50% ± n)` positioning.
 */

type Tile = {
  src: string;
  /** square box size in px */
  size: number;
  /** corner radius in px */
  radius: number;
  /** horizontal offset from center (px, negative = left) */
  x: number;
  /** vertical offset from center (px, negative = up) */
  y: number;
  /** mirror horizontally (left-side tiles) */
  mirror?: boolean;
  /** eager-load (largest above-the-fold tile, LCP candidate) */
  priority?: boolean;
  alt: string;
};

const TILES: Tile[] = [
  { src: "/shots/shot2.png", size: 261, radius: 15, x: 0, y: 115, priority: true, alt: "" }, // center
  { src: "/shots/shot3.png", size: 158, radius: 10, x: 253.5, y: 50.5, alt: "" }, // inner right
  { src: "/shots/shot6.png", size: 158, radius: 20, x: -253.5, y: 50.5, mirror: true, alt: "" }, // inner left
  { src: "/shots/shot4.png", size: 117, radius: 7, x: 404, y: -74, alt: "" }, // mid right
  { src: "/shots/shot7.png", size: 117, radius: 7, x: -404, y: -74, mirror: true, alt: "" }, // mid left
  { src: "/shots/shot5.png", size: 76, radius: 5, x: 476.5, y: -207.5, alt: "" }, // far right
  { src: "/shots/shot8.png", size: 76, radius: 5, x: -476.5, y: -207.5, mirror: true, alt: "" }, // far left
];

export default function DesignShots() {
  return (
    <div className="relative size-full" aria-hidden>
      {TILES.map((tile) => (
        <div
          key={tile.src}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `calc(50% + ${tile.x}px)`,
            top: `calc(50% + ${tile.y}px)`,
            width: tile.size,
            height: tile.size,
          }}
        >
          <div className={`size-full ${tile.mirror ? "-scale-x-100" : ""}`}>
            <div
              className="relative size-full overflow-hidden bg-white"
              style={{ borderRadius: tile.radius }}
            >
              <Image
                src={tile.src}
                alt={tile.alt}
                fill
                sizes={`${tile.size}px`}
                priority={tile.priority}
                className="object-cover"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

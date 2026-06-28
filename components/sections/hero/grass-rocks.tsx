import Image from "next/image";

/**
 * Grass-rock overlay — the lush, grass-topped variant of the two cliffs (Figma
 * nodes 56:58 left / 69:175 right), exported at the same scale and edge anchor
 * as the bare <Rock>s so it registers pixel-for-pixel on top of them.
 *
 * It carries no reveal logic of its own: a radial-gradient mask (in globals.css)
 * hides the whole overlay at rest, and rock-hover.tsx uncovers it inside a soft
 * disc that tracks the pointer. Because the grass PNGs are transparent cutouts,
 * the disc only ever shows grass where it overlaps a cliff — move over open sky
 * and nothing reveals, so no hit-testing is needed.
 *
 * One full-hero overlay holds BOTH rocks so a single hero-relative mask drives
 * the reveal. Kept at z-0 like the bare rocks, rendered just after them so it
 * paints on top of the cliffs but stays under the centred collage/text.
 */
const GRASS = {
  left: { src: "/rocks/left-rock-grass.webp", width: 378, edge: "left-0" },
  right: { src: "/rocks/right-rock-grass.webp", width: 344, edge: "right-0" },
} as const;

export default function GrassRocks() {
  return (
    <div
      data-grass-overlay
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 select-none"
    >
      {(["left", "right"] as const).map((side) => {
        const { src, width, edge } = GRASS[side];
        return (
          <div key={side} className={`absolute bottom-0 h-full ${edge}`}>
            <Image
              src={src}
              alt=""
              width={width}
              height={982}
              // Pre-baked WebP cut-outs (high-res, hand-tuned quality). Skip
              // Next's optimizer — it was re-encoding them at q=75 and capping
              // the width, which softened the reveal on HiDPI/tall viewports.
              unoptimized
              className="rock-base-fade h-full w-auto object-bottom"
            />
          </div>
        );
      })}
    </div>
  );
}

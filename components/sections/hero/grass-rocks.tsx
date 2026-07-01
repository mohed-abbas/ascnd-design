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
 * the reveal. It sits at z-[100] — ABOVE both bare cliffs, including the left
 * rock which is lifted to z-[99] (rock.tsx) — so the hover reveal always paints
 * on top of the bare rock it overlays. The overlay is transparent except at the
 * cliff cut-outs and only ever shows grass inside the hover disc (which tracks
 * the cursor over the edge-anchored cliffs), so a high z doesn't cover the
 * centred collage/text.
 */
const GRASS = {
  left: { src: "/rocks/left-rock-grass.avif", width: 357, edge: "left-0" },
  right: { src: "/rocks/right-rock-grass.avif", width: 344, edge: "right-0" },
} as const;

export default function GrassRocks() {
  return (
    <div
      data-grass-overlay
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[100] select-none"
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
              // Pre-baked AVIF cut-outs (q80, full 1428×3928 res — visually
              // lossless vs the WebP master). Skip Next's optimizer — it was
              // re-encoding them at q=75 and capping the width, which softened
              // the reveal on HiDPI/tall viewports.
              unoptimized
              // Above the fold and same dimensions as the bare <Rock> beneath
              // it (which is also priority): the browser detects this overlay as
              // the LCP element, so eager-load + preload it to clear the warning
              // and avoid a late paint of the hero cliff.
              priority
              sizes={`${width}px`}
              className="rock-base-fade h-full w-auto object-bottom"
            />
          </div>
        );
      })}
    </div>
  );
}

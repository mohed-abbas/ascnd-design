import Image from "next/image";

/**
 * "Rock" — the cliffs that frame the hero (Figma nodes 103:19 left / 103:18
 * right). Each spans the full hero height, pinned to its edge and aligned to
 * the bottom (the design uses object-bottom on full-height images).
 *
 * Figma baked the sky behind each rock as a flat #62abff fill; the cut-outs are
 * color-keyed against that exact sky (= the site backdrop) so anti-aliased edges
 * composite cleanly over the live background. The LEFT rock is a 4× transparent
 * WebP exported from Figma node 103:19 (paired with the grass overlay's node
 * 56:58 at the same scale, so the two register); the right is still the legacy
 * PNG until it's re-exported to match.
 *
 * One component, parameterized by side — the two rocks are structurally
 * identical and will share the same (to-be-defined) hover animation. The rock
 * itself stays static.
 */

type Side = "left" | "right";

const ROCKS: Record<Side, { src: string; width: number; unoptimized?: boolean }> = {
  // Hand-tuned 4× cut-out — skip Next's optimizer (q75 re-encode softens it),
  // matching the grass overlay's pipeline.
  left: { src: "/rocks/left-rock.webp", width: 357, unoptimized: true },
  right: { src: "/rocks/right-rock.png", width: 344 },
};

export default function Rock({ side }: { side: Side }) {
  const { src, width, unoptimized } = ROCKS[side];
  return (
    <div
      data-rock
      data-rock-side={side}
      className={`pointer-events-none absolute bottom-0 h-full select-none ${
        side === "left" ? "left-0 z-[99]" : "right-0 z-0"
      }`}
    >
      <Image
        src={src}
        alt=""
        width={width}
        height={982}
        priority
        unoptimized={unoptimized}
        sizes={`${width}px`}
        className="rock-base-fade h-full w-auto object-bottom"
      />
    </div>
  );
}

import Image from "next/image";

/**
 * "Rock" — the cliffs that frame the hero (Figma nodes 103:19 left / 103:18
 * right). Each spans the full hero height, pinned to its edge and aligned to
 * the bottom (the design uses object-bottom on full-height images).
 *
 * Figma baked the sky behind each rock as a flat #62abff fill; the cut-outs are
 * color-keyed against that exact sky (= the site backdrop) so anti-aliased edges
 * composite cleanly over the live background. Both rocks are 4× transparent
 * WebPs exported from matched Figma frames — left from node 232:236, right from
 * 232:237 — each paired with its grass overlay (232:229 / 232:238) at the same
 * scale, so the bare rock and its hover grass register.
 *
 * One component, parameterized by side — the two rocks are structurally
 * identical and will share the same (to-be-defined) hover animation. The rock
 * itself stays static.
 */

type Side = "left" | "right";

const ROCKS: Record<Side, { src: string; width: number; unoptimized?: boolean }> = {
  // Hand-tuned 4× cut-outs, pre-encoded to AVIF (q80, full 1428×3928 res — PSNR
  // ~43dB RGB / ~62dB alpha vs the WebP master, i.e. visually lossless). Served
  // via `unoptimized` so Next's on-demand optimizer (which softened the
  // color-keyed edges at q75) never touches them. See docs/performance-audit.md.
  left: { src: "/rocks/left-rock.avif", width: 357, unoptimized: true },
  right: { src: "/rocks/right-rock.avif", width: 344, unoptimized: true },
};

export default function Rock({ side }: { side: Side }) {
  const { src, width, unoptimized } = ROCKS[side];
  return (
    <div
      data-rock
      data-rock-side={side}
      // Hidden below md: the hero drops both cliffs on mobile (they'd overlap
      // and swallow a phone screen), so the mobile hero has no rock framing.
      // max-md:hidden keeps desktop byte-identical.
      className={`pointer-events-none absolute bottom-0 h-full select-none max-md:hidden ${
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

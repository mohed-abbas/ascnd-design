import Image from "next/image";

/**
 * "Rock" — the cliffs that frame the hero (Figma nodes 103:19 left / 103:18
 * right). Each spans the full hero height, pinned to its edge and aligned to
 * the bottom (the design uses object-bottom on full-height images).
 *
 * Figma baked the sky behind each rock as a flat fill; both have been
 * color-keyed to transparent PNGs so they read as cutouts over any backdrop.
 *
 * One component, parameterized by side — the two rocks are structurally
 * identical and will share the same (to-be-defined) hover animation. The rock
 * itself stays static.
 */

type Side = "left" | "right";

const ROCKS: Record<Side, { src: string; width: number }> = {
  left: { src: "/rocks/left-rock.png", width: 357 },
  right: { src: "/rocks/right-rock.png", width: 344 },
};

export default function Rock({ side }: { side: Side }) {
  const { src, width } = ROCKS[side];
  return (
    <div
      className={`pointer-events-none absolute bottom-0 z-0 h-full select-none ${
        side === "left" ? "left-0" : "right-0"
      }`}
    >
      <Image
        src={src}
        alt=""
        width={width}
        height={982}
        priority
        sizes={`${width}px`}
        className="h-full w-auto object-bottom"
      />
    </div>
  );
}

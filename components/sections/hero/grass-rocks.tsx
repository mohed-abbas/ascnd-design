"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import RockArt from "@/components/ui/rock-art";

/**
 * Grass-rock overlay — grass, moss and flowers that grow over the two cliffs
 * (originally Figma nodes 56:58 left / 69:175 right; now cut from a full rock
 * render, see GRASS below), framed at the same edge anchor and aspect as the
 * bare <Rock>s so their outlines register on top of them.
 *
 * It carries no reveal logic of its own: a radial-gradient mask (in globals.css)
 * hides the whole overlay at rest, and rock-hover.tsx uncovers it inside a soft
 * disc that tracks the pointer. Because the grass cut-outs are transparent, the
 * disc only ever shows grass where it overlaps a cliff — move over open sky and
 * nothing reveals, so no hit-testing is needed.
 *
 * ONE full-hero overlay PER SIDE, each carrying the same hero-relative mask
 * (rock-hover.tsx feeds identical vars to both), so each side can sit at its
 * own depth: directly above ITS bare cliff, and on the same side of the
 * front-plane rock clouds (plane-canvas, z 61) as that cliff.
 * - left  z-[100]: above the left rock, which is lifted to z-[99] (rock.tsx) —
 *   both sit above the clouds.
 * - right z-[1]: above the right rock (z-0) but BELOW the z-61 clouds, so its
 *   grass sinks into the cloud bank with the rock's base. A single z-[100]
 *   overlay painted the right grass ON TOP of that cloud, leaving dark grass
 *   floating on white where the rock itself was buried.
 * Each overlay is transparent except at its cliff cut-out and only ever shows
 * grass inside the hover disc, so neither covers the centred collage/text.
 *
 * PERF (docs/performance-audit.md A1/A3): the grass cut-outs are ~1.3MB of AVIF
 * that only ever appear inside a mouse-driven hover disc. So we gate the heavy
 * <Image> children on `(pointer: fine)` AND not-reduced-motion — the exact
 * conditions rock-hover.tsx needs to reveal them — via useSyncExternalStore
 * (server snapshot `false`, so SSR ships no <img>, re-evaluated after hydration,
 * no mismatch). On touch / coarse-pointer devices the bytes never download.
 *
 * The `[data-grass-overlay]` wrappers are ALWAYS rendered (even when the
 * images aren't), so rock-hover.tsx always finds its mask targets — no
 * mount-timing race when it wires on the intro-skipped path. When the images do
 * render they're `loading="lazy"` (not `priority`) to stay off the critical
 * request path.
 *
 * LCP workaround: Chrome's LCP heuristic ignores `opacity: 0` but NOT
 * mask-hidden paint — so this full-height overlay, invisible at rest, was being
 * attributed as the page's LCP element (a lazy 1.3MB image nobody sees). The
 * wrapper therefore mounts at `opacity-0`, which removes it from LCP candidacy
 * entirely; rock-hover.tsx flips it to 1 on the first pointer move over the
 * hero (the moment the reveal could first matter). Do NOT "fix" the dev
 * warning with loading="eager" — that would pull 1.3MB onto the critical path
 * for an invisible image.
 */
// Both are v2: cut from ONE full, cleanly-matted render of the whole rock
// rather than the cropped Figma exports, whose rough cut-outs left the
// original backdrop showing as white patches between the grass blades. The
// cliffs are two sides of that same rock:
// - RIGHT = the render's LEFT side: scaled 0.98×, offset (-75, -415) px onto an
//   860×2455 frame (2.5× the 344×982 slot) — ~98% outline overlap with the
//   bare right rock.
// - LEFT = the render's RIGHT side: a 1:1 crop at (1986, 902) px onto an
//   830×2284 frame (~2.33× the 357×982 slot) — ~96% overlap with the bare left
//   rock; the remainder is grass overhanging the rock edge, as before.
// Each frame is the render's native sharpness (no upscale). The render's
// light-blue flowers had been keyed out as holes; they were filled from the
// surrounding moss.
//
// v3 — GRASS ONLY. The render's rock is a different drawing from the bare
// rocks (only the outlines match), so revealing it whole showed a second rock
// whose cracks doubled up in the disc's soft ring — a "fish-eye" lens rather
// than grass growing on the stone. Every rock pixel is therefore masked out
// (a green-hue + saturated-flower mask, closed and feathered), so the disc
// keeps showing the BARE rock with only grass, moss and flowers fading in on
// top. The pixels were also colour-matched to the bare rocks' cool grade
// (LAB mean/std transfer of the rock pixels; a gentler 60% lightness + cast
// shift on the vegetation so it stays green). AVIF q80. The version suffix
// busts the /rocks cache (next.config.ts) on each swap.
//
// Right v4: its darker moss needed a looser mask, which also let in the
// render's dull grey lichen; over the dark bare rock that showed as pale,
// blocky blotches at the base. v4 keeps only clearly green growth (hue +
// saturation + green excess), closes it with round blur-threshold steps
// instead of square min/max kernels, and drops any dull pixel that would paint
// much lighter than the bare rock beneath it.
// `z` is each side's overlay depth — see the header for why they differ.
const GRASS = {
  left: {
    src: "/rocks/left-rock-grass.v3.avif",
    width: 357,
    edge: "left-0",
    z: "z-[100]",
  },
  right: {
    src: "/rocks/right-rock-grass.v4.avif",
    width: 344,
    edge: "right-0",
    z: "z-[1]",
  },
} as const;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const FINE_POINTER = "(pointer: fine)";

function subscribe(callback: () => void) {
  const mqs = [
    window.matchMedia(REDUCE_MOTION),
    window.matchMedia(FINE_POINTER),
  ];
  mqs.forEach((mq) => mq.addEventListener("change", callback));
  return () => mqs.forEach((mq) => mq.removeEventListener("change", callback));
}

function getSnapshot() {
  return (
    window.matchMedia(FINE_POINTER).matches &&
    !window.matchMedia(REDUCE_MOTION).matches
  );
}

// Only mount the overlay where the hover reveal can actually run (fine pointer,
// motion allowed). Server snapshot `false` → no SSR bytes, no hydration mismatch.
function useHoverEligible() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export default function GrassRocks() {
  const eligible = useHoverEligible();

  return (["left", "right"] as const).map((side) => {
    const { src, width, edge, z } = GRASS[side];
    return (
      <div
        key={side}
        data-grass-overlay
        aria-hidden
        // Hidden below md alongside the bare cliffs — the mobile hero shows no
        // rocks, so the grass hover overlay goes with them. (On touch phones
        // the heavy images already never mount via useHoverEligible; this also
        // covers a ≤768px viewport that happens to report a fine pointer.)
        // Desktop unaffected — max-md:hidden only.
        // opacity-0: keeps this mask-hidden overlay out of Chrome's LCP
        // candidate set (see the LCP note in the header). rock-hover.tsx sets
        // opacity 1 on the first pointer move over the hero; the reveal disc
        // is mask-driven, so the flip itself is invisible.
        className={`pointer-events-none absolute inset-0 ${z} select-none opacity-0 max-md:hidden`}
      >
        {eligible && (
          <div
            // Lets globals.css give each side's grass the same base-fade band
            // as the bare rock beneath it.
            data-grass-side={side}
            className={`absolute bottom-0 h-full ${edge}`}
          >
            {/* Same treatment layers as the bare rock beneath (rock-art.tsx),
                so the grass recolours with it in every mode. */}
            <RockArt
              src={src}
              sizes={`${width}px`}
              kind="grass"
              className="rock-base-fade relative h-full"
            >
              <Image
                src={src}
                alt=""
                width={width}
                height={982}
                // Pre-baked AVIF cut-outs (q80, at the source render's native
                // sharpness — see GRASS above). Skip Next's optimizer — it was
                // re-encoding them at q=75 and capping the width, which softened
                // the reveal on HiDPI/tall viewports.
                unoptimized
                // Never the LCP (the bare <Rock> is) and only seen inside the
                // hover disc, so keep it off the critical path.
                loading="lazy"
                sizes={`${width}px`}
                className="h-full w-auto object-bottom"
              />
            </RockArt>
          </div>
        )}
      </div>
    );
  });
}

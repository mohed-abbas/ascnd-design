"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";

/**
 * Grass-rock overlay — the lush, grass-topped variant of the two cliffs (Figma
 * nodes 56:58 left / 69:175 right), exported at the same scale and edge anchor
 * as the bare <Rock>s so it registers pixel-for-pixel on top of them.
 *
 * It carries no reveal logic of its own: a radial-gradient mask (in globals.css)
 * hides the whole overlay at rest, and rock-hover.tsx uncovers it inside a soft
 * disc that tracks the pointer. Because the grass cut-outs are transparent, the
 * disc only ever shows grass where it overlaps a cliff — move over open sky and
 * nothing reveals, so no hit-testing is needed.
 *
 * One full-hero overlay holds BOTH rocks so a single hero-relative mask drives
 * the reveal. It sits at z-[100] — ABOVE both bare cliffs, including the left
 * rock which is lifted to z-[99] (rock.tsx) — so the hover reveal always paints
 * on top of the bare rock it overlays. The overlay is transparent except at the
 * cliff cut-outs and only ever shows grass inside the hover disc, so a high z
 * doesn't cover the centred collage/text.
 *
 * PERF (docs/performance-audit.md A1/A3): the grass cut-outs are ~1.3MB of AVIF
 * that only ever appear inside a mouse-driven hover disc. So we gate the heavy
 * <Image> children on `(pointer: fine)` AND not-reduced-motion — the exact
 * conditions rock-hover.tsx needs to reveal them — via useSyncExternalStore
 * (server snapshot `false`, so SSR ships no <img>, re-evaluated after hydration,
 * no mismatch). On touch / coarse-pointer devices the bytes never download.
 *
 * The wrapper `[data-grass-overlay]` <div> is ALWAYS rendered (even when the
 * images aren't), so rock-hover.tsx always finds its mask target — no
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
const GRASS = {
  left: { src: "/rocks/left-rock-grass.avif", width: 357, edge: "left-0" },
  right: { src: "/rocks/right-rock-grass.avif", width: 344, edge: "right-0" },
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

  return (
    <div
      data-grass-overlay
      aria-hidden
      // Hidden below md alongside the bare cliffs — the mobile hero shows no
      // rocks, so the grass hover overlay goes with them. (On touch phones the
      // heavy images already never mount via useHoverEligible; this also covers
      // a ≤768px viewport that happens to report a fine pointer.) Desktop
      // unaffected — max-md:hidden only.
      // opacity-0: keeps this mask-hidden overlay out of Chrome's LCP candidate
      // set (see the LCP note in the header). rock-hover.tsx sets opacity 1 on
      // the first pointer move over the hero; the reveal disc is mask-driven,
      // so the flip itself is invisible.
      className="pointer-events-none absolute inset-0 z-[100] select-none opacity-0 max-md:hidden"
    >
      {eligible &&
        (["left", "right"] as const).map((side) => {
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
                // Never the LCP (the bare <Rock> is) and only seen inside the
                // hover disc, so keep it off the critical path.
                loading="lazy"
                sizes={`${width}px`}
                className="rock-base-fade h-full w-auto object-bottom"
              />
            </div>
          );
        })}
    </div>
  );
}

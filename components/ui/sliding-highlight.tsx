"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";

// useLayoutEffect on the client (park the pill on the active segment BEFORE
// paint, so it never flashes at 0×0 in the corner), plain useEffect on the
// server so React doesn't warn during SSR. Same idiom as the section reveals.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Travel time of the pill between two segments. */
const DURATION = 0.42;
/** Decisive departure, soft arrival — it should read as one continuous slide. */
const EASE = "power3.out";

/**
 * Shared "sliding pill" mechanic for the site's segmented controls (the sky-mode
 * rails in mode-switcher.tsx + the navbar's mobile theme column, and the
 * portfolio filter tabs).
 *
 * The active state used to be a class on the winning button, so switching was a
 * cross-fade of two backgrounds — the highlight blinked from one slot to the
 * other. Here ONE pill element is absolutely positioned inside the group and
 * animated to the active button's box, so it physically travels the distance,
 * past any segments in between.
 *
 * Geometry comes from `offsetLeft/offsetTop/offsetWidth/offsetHeight` rather
 * than getBoundingClientRect: those are measured from the offsetParent's PADDING
 * box, which is the same origin an `absolute; left:0; top:0` child resolves
 * against — so the numbers drop straight into x/y with no border/padding
 * correction. It does mean the group must be `relative` (it has to be the
 * offsetParent) and each button `relative` (positioned elements paint above
 * non-positioned siblings, so a static button would render UNDER the pill).
 *
 * Works for both axes without knowing which it is: a vertical rail simply only
 * changes y, a horizontal one mostly changes x and width.
 *
 * @param activeKey the currently selected segment's key. Each button in the
 *   group must carry `data-highlight={key}` for its own key.
 */
export function useSlidingHighlight(activeKey: string) {
  const groupRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  // Has the pill been placed at least once? The first placement snaps (there is
  // no previous segment to travel from); every later one animates.
  const placed = useRef(false);

  useIsomorphicLayoutEffect(() => {
    const group = groupRef.current;
    const pill = pillRef.current;
    if (!group || !pill) return;

    // An arrow const, not a hoisted `function` — TypeScript keeps the null
    // narrowing of `group`/`pill` above only for closures created after it.
    const place = (animate: boolean) => {
      const target = group.querySelector<HTMLElement>(
        `[data-highlight="${CSS.escape(activeKey)}"]`,
      );
      if (!target) return;

      const box = {
        x: target.offsetLeft,
        y: target.offsetTop,
        width: target.offsetWidth,
        height: target.offsetHeight,
      };

      if (animate && placed.current) {
        // overwrite:auto so a fast second click retargets the in-flight tween
        // from wherever the pill currently is, instead of stacking two tweens.
        gsap.to(pill, { ...box, duration: DURATION, ease: EASE, overwrite: "auto" });
      } else {
        gsap.set(pill, { ...box, autoAlpha: 1 });
        placed.current = true;
      }
    };

    place(true);

    // Re-measure when the group's own box changes — the breakpoint swap on the
    // portfolio tabs (padding + font-size both shrink below md) and late web-font
    // swaps both move every segment. Snap rather than animate: this is a re-fit,
    // not a selection, and a tween here would look like a stray slide.
    //
    // The observer's SEEDING callback (fired once on observe) is skipped, or it
    // would land right on top of the `place(true)` above and kill the tween the
    // moment it started.
    let seeded = false;
    const ro = new ResizeObserver(() => {
      if (!seeded) {
        seeded = true;
        return;
      }
      place(false);
    });
    ro.observe(group);

    return () => ro.disconnect();
  }, [activeKey]);

  return { groupRef, pillRef };
}

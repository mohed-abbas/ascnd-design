"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";

// See sliding-highlight.tsx for why this pair exists.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Matches the navbar's own DURATION/EASE feel, a touch quicker than the box. */
const DURATION = 0.45;
const EASE = "power2.inOut";

/**
 * The navbar pill's menu glyph: two hamburger lines that ROTATE into the ✕
 * rather than being swapped for a different icon.
 *
 * This replaces the old `{open ? <CloseIcon/> : <MenuLines/>}` conditional —
 * two separate SVGs (Figma nodes 75:346–347 and 75:381) at two different sizes,
 * so toggling hard-cut from one glyph to the other AND nudged the icon 3px in
 * the button's `justify-between` column, because the close icon was 13px tall
 * against the lines' 7px. One element at one size fixes both.
 *
 * ── The geometry ────────────────────────────────────────────────────────────
 * The markup IS the closed state, so SSR and no-JS render the Figma hamburger
 * exactly as before (viewBox 0 0 17 7, rendered at 17×7, 1.5 stroke):
 *
 *   top     (0.75, 1) → (16.25, 1)    length 15.5, centre (8.5, 1)
 *   bottom  (4, 6)    → (13, 6)       length 9,    centre (8.5, 6)
 *
 * Open is an ✕ centred on the box's middle (8.5, 3.5) with both arms at the top
 * line's 15.5 length — which is a 10.96px span, matching the old 13px CloseIcon's
 * 10.83px almost exactly. Each line gets there by rotating ±45° about ITS OWN
 * centre and then sliding 2.5 units to the shared middle:
 *
 *   top     rotate  45°, y +2.5   (svgOrigin 8.5 1)   ╲
 *   bottom  rotate -45°, y −2.5   (svgOrigin 8.5 6)   ╱
 *
 * `svgOrigin` pins the pivot in the SVG's user space instead of the element's
 * bbox — a horizontal line has a ZERO-height bbox, and the bottom line's bbox
 * also changes width mid-tween, so an explicit pivot is the safe one. GSAP
 * composes SVG transforms as translate ∘ rotate-about-origin (CSSPlugin's
 * `_renderSVGTransforms`), so the pivot lands at origin + (x, y) — i.e. both
 * centres converge on (8.5, 3.5).
 *
 * The bottom line is the SHORT one, so it also has to grow 9 → 15.5. That's
 * animated on the x1/x2 ATTRIBUTES, not scaleX: scaling would stretch the round
 * linecaps into ellipses. It grows symmetrically about x=8.5, so the pivot holds
 * still while it does.
 *
 * strokeWidth rides along 1.5 → 1.75 because the two source icons disagreed
 * (the ✕ was drawn heavier); animating it keeps BOTH end states pixel-faithful
 * to their Figma nodes.
 *
 * The ✕'s arms overflow the 17×7 viewBox by ~2px vertically, hence
 * `overflow-visible` — that's deliberate, and it's what lets the closed
 * hamburger keep its exact 7px-tall footprint in the button's flex column.
 */
export default function MenuToggleIcon({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) {
  const topRef = useRef<SVGLineElement>(null);
  const bottomRef = useRef<SVGLineElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const mounted = useRef(false);

  useIsomorphicLayoutEffect(() => {
    const top = topRef.current;
    const bottom = bottomRef.current;
    if (!top || !bottom) return;

    const topState = { rotate: open ? 45 : 0, y: open ? 2.5 : 0, strokeWidth: open ? 1.75 : 1.5 };
    const bottomState = {
      rotate: open ? -45 : 0,
      y: open ? -2.5 : 0,
      strokeWidth: open ? 1.75 : 1.5,
      attr: open ? { x1: 0.75, x2: 16.25 } : { x1: 4, x2: 13 },
    };

    // First render: snap. There is no toggle to animate yet, and the markup is
    // already the closed state.
    if (!mounted.current) {
      mounted.current = true;
      gsap.set(top, { ...topState, svgOrigin: "8.5 1" });
      gsap.set(bottom, { ...bottomState, svgOrigin: "8.5 6" });
      return;
    }

    tlRef.current?.kill();
    const tl = gsap.timeline({ defaults: { duration: DURATION, ease: EASE } });
    tl.to(top, { ...topState, svgOrigin: "8.5 1" }, 0).to(
      bottom,
      { ...bottomState, svgOrigin: "8.5 6" },
      0,
    );

    tlRef.current = tl;
    return () => {
      tl.kill();
    };
  }, [open]);

  return (
    <svg
      viewBox="0 0 17 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      // overflow-visible: the ✕ arms reach ~2px past the 7-unit-tall box.
      className={`overflow-visible ${className ?? ""}`}
    >
      <line ref={topRef} x1="0.75" y1="1" x2="16.25" y2="1" />
      <line ref={bottomRef} x1="4" y1="6" x2="13" y2="6" />
    </svg>
  );
}

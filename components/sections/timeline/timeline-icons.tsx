import type { SVGProps } from "react";

/**
 * Inline icons for the timeline widgets, drawn on a 16×16 grid, `currentColor`
 * so they follow the chip's text colour. Kept as vectors (not Figma image
 * exports) because Phase 3 animates them — the spinner rotates, then swaps to the
 * check as the day-12 "in review → approved" beat resolves.
 */

/** Loading arc — a ~300° open ring. Rotated by GSAP for the day-12 spinner. */
export function Spinner(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden {...props}>
      <path
        d="M8 1.6a6.4 6.4 0 1 1-6.26 7.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Checkmark — the "done" state (day-12 resolve, day-5 badge, banked days). */
export function Check(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden {...props}>
      <path
        d="M3.4 8.5 6.3 11.4 12.6 4.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

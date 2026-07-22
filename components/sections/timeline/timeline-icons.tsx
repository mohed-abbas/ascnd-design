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

/**
 * The ascnd block mark that caps the timeline's end ("and up we go", Figma
 * 746:4538) — two offset white blocks whose bottom-left foot is where the dotted
 * spine lands. `currentColor` fill, so `text-white` colours it.
 */
export function AscndMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 38" fill="currentColor" aria-hidden {...props}>
      <path d="M30.4157 29.2986L26.0746 30.2621C25.4211 30.4071 24.774 29.995 24.629 29.3415L21.8934 17.0128C21.7484 16.3593 21.1013 15.9472 20.4478 16.0922L8.11911 18.8277C7.46561 18.9727 6.81846 18.5606 6.67346 17.9071L5.70996 13.5656C5.56496 12.9121 5.97707 12.265 6.63057 12.12L25.6665 7.8962C26.32 7.75119 26.9671 8.16331 27.1121 8.81681L31.3363 27.853C31.4815 28.5063 31.0692 29.1536 30.4157 29.2986Z" />
      <path d="M21.3427 31.3134L17.0019 32.2763C16.3484 32.4213 15.7013 32.0092 15.5563 31.3557L14.8342 28.1017C14.6892 27.4482 14.0419 27.0359 13.3886 27.181L10.1336 27.9035C9.48009 28.0485 8.83294 27.6364 8.68794 26.9829L7.72429 22.6416C7.57929 21.9881 7.9914 21.341 8.6449 21.196L18.6073 18.9851C19.2608 18.8401 19.9079 19.2522 20.0529 19.9057L22.2633 29.8677C22.4085 30.521 21.9962 31.1684 21.3427 31.3134Z" />
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

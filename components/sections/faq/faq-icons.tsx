/**
 * The FAQ pill toggle — Figma node 526:417 (the repeated 30×30 "Frame").
 *
 * Same two-tone construction as the pricing/comparison ticks: a full-white leg
 * (the vertical bar) plus a 40%-opacity leg (the two horizontal halves), for the
 * subtle diagonal light the whole site's iconography shares. Paths are lifted
 * verbatim from the Figma SVG export at its native 30×30 viewBox. Kept inline
 * (vs. a /public asset) so it inherits the flow, needs no request, and stays
 * trivially styleable.
 *
 * The parent rotates this 45° on expand, turning the "+" into an "×" — the
 * full-white bar becomes one diagonal, the dim horizontals the other, so the
 * open state stays two-tone too. Rotation lives on the wrapper in faq.tsx so it
 * can transition; this component is a pure static glyph.
 */
export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 30"
      fill="none"
      className={className}
      aria-hidden
    >
      {/* Vertical bar — full white. */}
      <path
        d="M14.0625 7.5C14.0625 6.98224 14.4822 6.5625 15 6.5625C15.5178 6.5625 15.9375 6.98224 15.9375 7.5V14.0628V15.9377V22.5009C15.9375 23.0186 15.5178 23.4384 15 23.4384C14.4822 23.4384 14.0625 23.0186 14.0625 22.5009V15.9377V14.0628V7.5Z"
        fill="white"
      />
      {/* Horizontal bar — the two halves at 40% for the diagonal light. */}
      <g opacity="0.4">
        <path
          d="M7.5 15.9375H14.0628V14.0625H7.5C6.98224 14.0625 6.5625 14.4822 6.5625 15C6.5625 15.5178 6.98224 15.9375 7.5 15.9375Z"
          fill="white"
        />
        <path
          d="M22.5006 14.0625H15.9375V15.9375H22.5006C23.0184 15.9375 23.4381 15.5178 23.4381 15C23.4381 14.4822 23.0184 14.0625 22.5006 14.0625Z"
          fill="white"
        />
      </g>
    </svg>
  );
}

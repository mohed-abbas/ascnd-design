/**
 * ascnd wordmark — the brand name set in Product Sans Medium. Figma node
 * 77:174 (lockup) / the hero's top-center mark.
 *
 * The full brand lockup pairs this with the chevron mark (see logo.tsx); in the
 * hero only the wordmark appears, centered at the top. Kept standalone and
 * animation-ready — it's plain text, so font-size/color follow the parent and
 * it can be animated freely (e.g. a letter-stagger reveal).
 *
 * Renders as an accessible heading; pass `className` to size/position it.
 */
export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-product font-medium leading-none tracking-[-0.03em] text-white ${className}`}
    >
      ascnd
    </span>
  );
}

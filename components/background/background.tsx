/**
 * Global site-wide sky backdrop: one fixed layer of solid fill + grain.
 * Mounted once at the root (layout.tsx).
 *
 * The volumetric clouds are a SEPARATE sibling layer (<CloudLayer/>, also
 * mounted at the root) so they can be z-stacked and toggled independently of
 * the sky — this backdrop sits at -z-20, the clouds at -z-10, content above.
 *
 * IMPORTANT: must have no `filter`/`backdrop-filter` ancestor — that breaks
 * `position: fixed` descendants (see docs/cloud-rendering-research.md §4).
 */
export default function Background() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-20 bg-[#62abff]"
    >
      {/* Grain — 1024px noise tile at 10% opacity, above the fill. */}
      <div className="absolute inset-0 bg-[url('/textures/grain.png')] bg-[length:1024px_1024px] bg-left-top opacity-10" />
    </div>
  );
}

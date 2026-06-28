import CloudLayer from "./cloud-layer";

/**
 * Global site-wide sky. One fixed layer behind all content: solid fill →
 * grain → volumetric clouds. Mounted once at the root (layout.tsx).
 *
 * IMPORTANT: must have no `filter`/`backdrop-filter` ancestor — that breaks
 * `position: fixed` descendants (see docs/cloud-rendering-research.md §4).
 * Cloud softness comes from the asset's alpha, never a CSS blur on a parent.
 */
export default function Background() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-[#62abff]"
    >
      {/* Grain — 1024px noise tile at 10% opacity, above the fill. */}
      <div className="absolute inset-0 bg-[url('/textures/grain.png')] bg-[length:1024px_1024px] bg-left-top opacity-10" />

      {/* Volumetric clouds (WebGL), above the grain. */}
      <div className="absolute inset-0">
        <CloudLayer />
      </div>
    </div>
  );
}

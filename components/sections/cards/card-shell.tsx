import type { ReactNode } from "react";

/**
 * Shared glass card shell (Figma nodes 220:163 / 220:170 / 220:212 — all three
 * cards share this look). A 440×438 frosted-glass panel over the shared sky:
 * 1.5px white edge, a faint top→bottom dark gradient, and a light backdrop blur.
 * The `media` children fill the panel; the lowercase title + subtitle sit
 * bottom-left, painting over the media (later DOM order → higher stacking).
 *
 * The border is white at ~30% opacity, NOT the opaque `border-white` that
 * get_design_context reported: the Figma frame's stroke is semi-transparent
 * (measured ~0.25-0.28 against the rendered node; the MCP flattens stroke
 * opacity), matching the navbar's house-style border-white/30. There is no
 * inner glow here: the real node's interior is uniform edge-to-center (unlike
 * the navbar, which does carry an inset white shadow).
 *
 * No backdrop-blur (frost-swept 2026-07-18): the card only ever sits over the
 * fixed sky, where the frost re-rastered ~193k px² per card per scrolled frame
 * for no visible product. The white inset veil stands in for the frost's
 * slight lift. See docs/backdrop-filter-sweep.md.
 */
export default function CardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article
      data-card-shell
      data-card-id={title}
      className="relative h-[438px] w-[440px] shrink-0 overflow-clip rounded-[20px] border-[1.5px] border-solid border-white/30 bg-gradient-to-b from-black/10 to-black/5 shadow-[inset_0_0_0_999px_rgba(255,255,255,0.06)]"
    >
      {children}

      <h3 className="absolute left-[31px] top-[319.5px] font-product text-[31px] font-normal leading-[1.1] tracking-[-0.03em] text-white">
        {title}
      </h3>
      <p className="absolute left-[30px] top-[363.5px] w-[310px] font-light text-[16px] leading-[1.1] text-white">
        {subtitle}
      </p>
    </article>
  );
}

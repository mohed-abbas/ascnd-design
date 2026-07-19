/**
 * Feature kill-switches — the sanctioned way to bench a feature without
 * deleting or commenting its code. Gate the feature's MOUNT SITE
 * (layout.tsx / page.tsx) with a flag: a literal `false` means the subtree is
 * never rendered, its lazy client chunks are never requested, and its
 * effects/canvases/tickers never run — zero runtime cost, and the imports
 * stay referenced so lint never flags dead code. Flip to `true` to bring the
 * feature back; nothing else changes.
 *
 * Server-safe: pure data, no browser APIs — importable from Server Components
 * and client code alike.
 */
export const FLAGS = {
  /**
   * The fixed cloud layers (volumetric WebGL views on the shared REAR/FRONT
   * canvas planes on desktop, static DOM sprites on mobile/reduced-motion) and
   * the cloud-sprite preload in layout.tsx. Benched 2026-07-18 during the fps
   * campaign; returned 2026-07-19 as shared-canvas views (Phase 4,
   * docs/canvas-consolidation-plan.md).
   */
  clouds: true,
  /**
   * The footer (mountain range + liquid-glass wordmark). Benched pending a
   * different approach.
   */
  footer: false,
} as const;

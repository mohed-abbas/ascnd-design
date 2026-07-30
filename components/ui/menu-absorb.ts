/**
 * The absorption channel between the navbar's morphing glass and the standalone
 * glass controls that share its column — the sky-mode switcher above the pill
 * (mode-switcher.tsx) and the back-to-top disc below it (back-to-top.tsx).
 *
 * THE PROBLEM. The menu is ONE glass surface that grows from the 52×149 pill to
 * fill its whole 406×365 frame (navbar.tsx), and that frame covers both discs
 * completely — measured: 100% of each, all four controls on the same 52px
 * column. Sitting at z-900 under the z-999 panel, they showed through an open
 * menu as two ghost pucks blurred behind its glass.
 *
 * THE FIX. Let the growing glass EAT them. Each control keeps its icon but
 * dissolves its own chrome — border, fill, inset veil, blur — in step with how
 * much of it the panel has swallowed, so once the edge has swept past there is
 * one continuous surface with the icon resting on it. That's the single-glass
 * reading the mobile panel already has, where the theme picker is a real child
 * of the menu; this gets desktop there without moving anything.
 *
 * Coverage, not a timed fade: the chrome tracks the actual overlap area, so an
 * interrupted toggle (open, then close again mid-morph) reverses correctly
 * instead of replaying a fixed delay it can no longer honour.
 *
 * WHY A PLAIN MODULE, NOT REACT STATE. This updates every frame of the 0.65s
 * morph. A store that re-rendered the navbar — and with it the mode switcher's
 * whole timeline machinery — 40 times per open would be a far worse trade than
 * two direct style writes per frame.
 *
 * NEITHER SIDE READS LAYOUT PER FRAME. The navbar computes the glass rect
 * ARITHMETICALLY, from the nav frame plus the insets GSAP is tweening; each
 * control's own rect is measured once per morph and cached, since nothing moves
 * it while the panel grows. Measuring either per frame would force a synchronous
 * layout of the whole document on every tick, during the one animation that has
 * a heavy blurred surface already resizing.
 */

/** Viewport-space edges of the menu glass, in px. */
export type GlassRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type Entry = {
  /** The control whose footprint the glass swallows. */
  el: HTMLElement;
  /** Its glass layer — the thing that dissolves. Never the icon. */
  chrome: HTMLElement;
  /**
   * Optional counterpart that fades IN as the chrome fades out: what this
   * control looks like once it's a member of the menu rather than a puck of its
   * own. The sky switcher uses it to arrive wearing the in-panel SELECTED
   * highlight, the same lit disc the mobile theme column gives the active mode.
   * Controls that are plain actions (back-to-top) pass nothing and simply hand
   * their icon over to the menu's surface.
   */
  absorbed: HTMLElement | null;
  /** Measured once per morph (see the no-layout-per-frame note above). */
  rect: DOMRect | null;
};

const targets = new Set<Entry>();

/** The last published glass, or null when the menu is closed / not morphing. */
let glass: GlassRect | null = null;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Register a control as absorbable. Returns the unsubscribe, which also hands
 * the chrome's opacity back to CSS.
 *
 * A control that mounts (or becomes visible) while the menu is ALREADY open is
 * applied immediately — the back-to-top disc appears on scroll, and scrolling
 * with the panel open is allowed, so it can arrive mid-absorption. Without this
 * it would pop in as a puck sitting on top of the panel.
 */
export function registerAbsorbable(
  el: HTMLElement,
  chrome: HTMLElement,
  absorbed?: HTMLElement | null,
): () => void {
  const entry: Entry = { el, chrome, absorbed: absorbed ?? null, rect: null };
  targets.add(entry);
  if (glass) apply(entry, glass);
  return () => {
    targets.delete(entry);
    release(entry);
  };
}

/**
 * Publish the menu glass's current edges — every frame of the morph. Pass null
 * when the menu is closed (or on a breakpoint where absorption doesn't apply),
 * which restores every chrome and drops the cached rects.
 */
export function publishGlass(rect: GlassRect | null): void {
  glass = rect;
  for (const entry of targets) {
    if (!rect) {
      entry.rect = null;
      release(entry);
      continue;
    }
    apply(entry, rect);
  }
}

/**
 * Cross-fade the two skins on how much of this control's box the glass covers:
 * the standalone chrome leaves at 1 − coverage, the in-menu skin arrives at
 * coverage. Half-swallowed is genuinely half of each, which is what makes the
 * hand-off read as one surface absorbing another rather than a swap.
 */
function apply(entry: Entry, rect: GlassRect): void {
  const r = (entry.rect ??= entry.el.getBoundingClientRect());
  // 0×0 = display:none (the switcher below md) — nothing to dissolve.
  if (!r.width || !r.height) return;
  const overlapX = Math.min(rect.right, r.right) - Math.max(rect.left, r.left);
  const overlapY = Math.min(rect.bottom, r.bottom) - Math.max(rect.top, r.top);
  const swallowed = clamp01(
    (Math.max(0, overlapX) * Math.max(0, overlapY)) / (r.width * r.height),
  );
  entry.chrome.style.opacity = String(1 - swallowed);
  if (entry.absorbed) entry.absorbed.style.opacity = String(swallowed);
}

/** Hand both skins back to CSS (chrome shows, in-menu skin hides). */
function release(entry: Entry): void {
  entry.chrome.style.opacity = "";
  if (entry.absorbed) entry.absorbed.style.opacity = "";
}

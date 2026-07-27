/**
 * The one contract between the portfolio wall's two independent behaviours: the
 * marquee that drifts the columns (grid-marquee.tsx) and the expand that opens
 * a tile (grid-expand.tsx). While a tile is open the whole wall holds still —
 * the columns keep drifting under a lightbox would be absurd, and the expand
 * needs the tile it flew from to stay put so it has somewhere to fly back to.
 *
 * A window event rather than shared React state or a prop, for the same reason
 * intro-state.ts uses one: the two components are siblings that must not know
 * about each other's lifecycle. Either can mount, unmount or rebuild (the
 * marquee rebuilds on every filter change and every resize) without the other
 * holding a stale handle to it. The marquee simply applies whatever the last
 * event said, and a marquee that rebuilds while a tile is open reads the
 * current value from `isFrozen()` instead of waiting for another event.
 *
 * Module-scoped rather than read off the DOM so it survives that rebuild, and
 * so nothing has to guess whether "no event yet" means thawed.
 */
export const GRID_FREEZE_EVENT = "ascnd:grid-freeze";

let frozen = false;

/** Is the wall currently held still? Read by a marquee build mid-expand. */
export function isFrozen(): boolean {
  return frozen;
}

/**
 * Freeze or thaw the wall. Idempotent: setting the value it already holds
 * dispatches nothing, so a stray double-close can't fire a second thaw at a
 * marquee that has since been legitimately frozen again.
 */
export function setFrozen(next: boolean): void {
  if (frozen === next) return;
  frozen = next;
  window.dispatchEvent(
    new CustomEvent(GRID_FREEZE_EVENT, { detail: { frozen: next } }),
  );
}

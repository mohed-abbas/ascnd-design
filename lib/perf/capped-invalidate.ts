/**
 * Scroll-repaint cap for demand-mode canvases (audit F4.2).
 *
 * ScrollTrigger fires onUpdate at the scroll-event rate — up to 120 Hz on a
 * fast panel — and the scroll rigs (clouds' ScrollAnchorRig/SectionRig, the
 * intro's ScrollRig) invalidate() a repaint per update. These layers are
 * scroll-LINKED — some welded 1:1 to DOM content scrolling at the panel's
 * native rate — so on the high tier they ride the display uncapped: painting
 * them at 60 against 120 Hz DOM made the weld visibly stagger (the jitter
 * felt when scrolling out of the hero). `scrollRepaintFpsCap()` returns 0
 * (uncapped) on high, 60 on stepped-down tiers (the cap is re-read per call,
 * so a mid-session step-down takes effect immediately). Self-animating pumps
 * (glass, conveyor, footer) still use heavyEffectFpsCap() directly — no
 * reference frame, so 60 is genuinely invisible there.
 *
 * Skipping is done with a TRAILING paint: a call inside the throttle window
 * arms one timer for the window's end, so the LAST update of a scrub is always
 * painted — a scroll can never park one frame stale. Call `.cancel()` in the
 * effect cleanup so a pending trailing paint can't fire after unmount.
 */

import { scrollRepaintFpsCap } from "./quality-store";

export interface CappedInvalidate {
  (): void;
  /** Drop a pending trailing paint (call from the effect cleanup). */
  cancel(): void;
}

export function makeCappedInvalidate(invalidate: () => void): CappedInvalidate {
  let last = 0; // performance.now() of the last painted frame
  let trailing: ReturnType<typeof setTimeout> | undefined;

  const paint = () => {
    if (trailing !== undefined) {
      clearTimeout(trailing);
      trailing = undefined;
    }
    last = performance.now();
    invalidate();
  };

  const capped = (() => {
    const cap = scrollRepaintFpsCap();
    if (cap === 0) {
      paint();
      return;
    }
    const step = 1000 / cap;
    const elapsed = performance.now() - last;
    if (elapsed >= step) {
      paint();
    } else if (trailing === undefined) {
      trailing = setTimeout(paint, step - elapsed);
    }
  }) as CappedInvalidate;

  capped.cancel = () => {
    if (trailing !== undefined) {
      clearTimeout(trailing);
      trailing = undefined;
    }
  };

  return capped;
}

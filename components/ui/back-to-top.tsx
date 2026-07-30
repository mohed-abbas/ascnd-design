"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useLenis } from "lenis/react";
import { ArrowUp } from "./icons";
import { registerAbsorbable } from "./menu-absorb";

/**
 * Back-to-top control — a 52px glass disc parked directly under the navbar pill.
 *
 * Rendered BY navbar.tsx (not layout.tsx) so it exists exactly where the navbar
 * does: it's positioned relative to the pill, so a route without a navbar would
 * otherwise show a lone floating button under nothing.
 *
 * PLACEMENT mirrors navbar.tsx's geometry, so the two read as one stack:
 *   • Desktop — the nav frame is `right-[33px] top-[62.4%]`, 365 tall, centred
 *     on its own height; the pill inside it is `right-[22px]`, 52×149, centred
 *     vertically. So the pill's right edge sits 33+22 = 55px from the viewport
 *     right and its bottom at 62.4vh + 74.5px. This disc is the same 52 wide
 *     (right-[55px] ⇒ same centre-line) and starts 12px below that bottom edge.
 *   • Below md — the navbar re-anchors to a bottom-centre 140×52 capsule
 *     (bottom-[20px]), so "below" would be off-screen. The disc moves to the
 *     bottom-RIGHT corner instead, on the same 20px inset and the same 52px
 *     height, so it lines up with the capsule beside it.
 *
 * VISIBILITY: hidden until the page is scrolled past 60% of a viewport, then it
 * fades + rises in. Read through `useSyncExternalStore` over a passive scroll
 * listener rather than state + an effect:
 *   • the snapshot is a BOOLEAN, so React re-renders only when the threshold is
 *     actually crossed — scrolling doesn't re-render the navbar per frame;
 *   • the server snapshot is `false` and the client's is read at mount, so a
 *     load that already lands mid-page (a /pricing#book deep link) shows the
 *     disc immediately with no hydration mismatch and no setState-in-effect;
 *   • Lenis scrolls the real window in root mode, so native `scroll` fires
 *     throughout a smooth scroll — this is a listener, not a second rAF loop,
 *     so it doesn't compete with LenisProvider's one ticker.
 *
 * The glass recipe (border/bg/inset glow/blur) is the house one shared with the
 * navbar surface and the mode-switcher rail. It's a sibling of the fixed sky
 * layers, never an ancestor, so its backdrop-filter can't break their
 * `position: fixed` (see CLAUDE.md).
 *
 * ABSORPTION (desktop): an open menu's glass covers this disc completely, so
 * rather than show through it as a ghost puck, the panel eats it — the chrome is
 * a separate layer that dissolves as the glass sweeps over it, leaving the arrow
 * on the menu's own surface. See menu-absorb.ts. Below md the panel only laps
 * ~81% of this disc (it's the bottom-RIGHT corner there, the panel bottom-CENTRE),
 * so the navbar doesn't publish on mobile and this stays a puck — dissolving a
 * partly-covered control would strand the icon off the panel's corner.
 *
 * The chrome's absorb opacity and the button's own show/hide opacity MULTIPLY,
 * which is what we want: a disc that hasn't been scrolled into view stays hidden
 * no matter what the menu is doing.
 */

// Fraction of a viewport height that must be scrolled before the disc appears.
const SHOW_AFTER = 0.6;

// Resize is in here too: the threshold is viewport-relative, so a window resize
// (or a phone's URL bar collapsing) can cross it without any scrolling.
function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}

const isScrolled = () => window.scrollY > window.innerHeight * SHOW_AFTER;
const serverSnapshot = () => false;

export default function BackToTop() {
  const visible = useSyncExternalStore(subscribe, isScrolled, serverSnapshot);
  const lenis = useLenis();
  const rootRef = useRef<HTMLButtonElement>(null);
  const chromeRef = useRef<HTMLSpanElement>(null);

  // Offer this disc's glass to the navbar's expanding panel (see menu-absorb.ts).
  useEffect(() => {
    const root = rootRef.current;
    const chrome = chromeRef.current;
    if (!root || !chrome) return;
    return registerAbsorbable(root, chrome);
  }, []);

  function toTop() {
    if (lenis) lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: "smooth" });
    // Drop any section fragment the in-page nav left in the URL (anchor-link.tsx
    // writes one on every same-page jump). We're at the top now, so the hash is
    // stale — and leaving it there is what makes the NEXT refresh try to anchor
    // mid-page (the reason layout.tsx has to strip it during parse).
    if (window.location.hash) {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }

  return (
    <button
      ref={rootRef}
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      title="Back to top"
      // Kept mounted and faded rather than unmounted, so it has something to
      // transition between; while hidden it's inert (no pointer events, out of
      // the tab order, hidden from AT).
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      // The backdrop-blur runs on every input type, phones included — same
      // deliberate call as the navbar capsule and the portfolio filter pill:
      // this is `fixed`, so on a phone the filter resamples the moving page
      // behind it every scroll frame, and that cost is accepted for the glass.
      //
      // `invisible` (not just opacity-0) while hidden is the part that stays,
      // and it now matters more: kept mounted for its transition, the disc was
      // compositing that blur layer even while unseen. `visibility: hidden`
      // takes it out of compositing entirely, so the cost is only paid once
      // the control is actually on screen. The opacity transition still runs —
      // visibility animates discretely and flips at the start of the fade-in.
      // z-1000 (over the z-999 nav, not under it) so the menu dissolves this
      // disc from ON TOP as it swallows it — underneath, the panel's edge would
      // drag across the disc as a visible seam. See menu-absorb.ts.
      className={`group fixed right-[55px] top-[calc(62.4%_+_87px)] z-[1000] flex size-[52px] items-center justify-center rounded-full text-white transition-[opacity,transform] duration-300 ease-out max-md:bottom-[20px] max-md:right-[20px] max-md:top-auto ${
        visible
          ? "pointer-events-auto visible translate-y-0 opacity-100"
          : "pointer-events-none invisible translate-y-[10px] opacity-0"
      }`}
    >
      {/* The glass, as its own layer so the menu can dissolve it while the arrow
          stays. The button itself is placement, hit area and focus ring. */}
      <span
        ref={chromeRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full border border-white/30 bg-white/10 shadow-[inset_0_0_28.3px_0_rgba(255,255,255,0.25)] backdrop-blur-[10px] transition-colors duration-200 group-hover:bg-white/20"
      />
      <ArrowUp className="relative h-[16px] w-[14px]" />
    </button>
  );
}

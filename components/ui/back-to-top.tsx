"use client";

import { useSyncExternalStore } from "react";
import { useLenis } from "lenis/react";
import { ArrowUp } from "./icons";

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
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      title="Back to top"
      // Kept mounted and faded rather than unmounted, so it has something to
      // transition between; while hidden it's inert (no pointer events, out of
      // the tab order, hidden from AT).
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed right-[55px] top-[calc(62.4%_+_87px)] z-[900] flex size-[52px] items-center justify-center rounded-full border border-white/30 bg-white/10 text-white shadow-[inset_0_0_28.3px_0_rgba(255,255,255,0.25)] backdrop-blur-[10px] transition-[opacity,transform] duration-300 ease-out hover:bg-white/20 max-md:bottom-[20px] max-md:right-[20px] max-md:top-auto ${
        visible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-[10px] opacity-0"
      }`}
    >
      <ArrowUp className="h-[16px] w-[14px]" />
    </button>
  );
}

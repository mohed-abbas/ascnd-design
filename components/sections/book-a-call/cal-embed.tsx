"use client";

import { useEffect, useRef, useState } from "react";
import {
  CAL_BOOKING_CONFIG,
  CAL_LINK,
  CAL_UI_CONFIG,
  INLINE_NS,
  initCalNamespace,
} from "@/lib/cal/embed";

/**
 * The Cal.com inline booking embed that fills the section's glass box
 * (Figma 746:4550).
 *
 * The loader, the event link and the booker/theme config are all shared with the
 * site's booking BUTTONS (ui/book-call-button.tsx) — they live in
 * lib/cal/embed.ts, which is also where the "why the vanilla loader, not
 * @calcom/embed-react" reasoning and the light-theme pinning are documented.
 * This file owns only what is specific to the INLINE embed: when it boots and
 * how its container is sized/clipped.
 *
 * LOADING: the embed boots on MOUNT (deferred to idle so it never competes
 * with the page's first paint) rather than lazily on approach — a deliberate
 * trade: /pricing exists to get the call booked, so by the time the visitor
 * scrolls to the section the calendar must already be sitting there loaded.
 *
 * It also drives `--cal-frame-w` on the section's glass box so the dashed frame
 * follows the booker instead of standing at one fixed width — see the two
 * constants below.
 */

/**
 * How wide Cal draws the booker card once you pick a slot and it swaps to the
 * booking FORM: 660px, centred, regardless of the iframe's own width. Measured
 * in the live embed — an 898px iframe renders a 660px card with 119px of
 * TRANSPARENT gutter down each side, which is what left the glass frame standing
 * out past the card. In the month view the card FILLS the iframe instead (898 →
 * 898), which is why the frame hugs it perfectly there.
 *
 * `min(100%, …)` because the card is only 660 where there's room for 660: below
 * that Cal fills whatever it's given, and so should the frame.
 */
const CAL_FORM_CARD_WIDTH = "min(100%, 660px)";

/** Frame width when the card fills the iframe (month view, and while loading). */
const CAL_FULL_WIDTH = "100%";

/**
 * Ignore iframe-width changes smaller than this when deciding "the window was
 * resized". Cal reports every dimension change TWICE, once with and once
 * without its scrollbar — measured, the pair differs by 10px (890/900) — and
 * treating that flicker as a resize made the tracker re-learn the booking
 * FORM's height as the month view's, which inverted the frame on every step.
 */
const CAL_WIDTH_NOISE = 24;

/**
 * Read a Cal `__dimensionChanged` payload. Cal's own typings aren't imported
 * here (the loader is the vanilla one — lib/cal/embed.ts), so the payload is
 * narrowed by hand rather than cast. NB `iframeWidth` is the iframe's OWN width,
 * not the booker card's — that's the whole reason the card's width has to be
 * inferred rather than read.
 */
function dimension(event: unknown): { height: number; width: number } | null {
  const data = (
    event as {
      detail?: { data?: { iframeHeight?: unknown; iframeWidth?: unknown } };
    }
  )?.detail?.data;
  const height = data?.iframeHeight;
  const width = data?.iframeWidth;
  return typeof height === "number" && typeof width === "number"
    ? { height, width }
    : null;
}

export default function CalEmbed() {
  const boxRef = useRef<HTMLDivElement>(null);
  // Flipped by Cal's `linkReady` event: while loading, the container holds the
  // section's design height for the placeholder; once ready it hugs the booker
  // card instead, clipping Cal's ~80px branding strip off the bottom (the site
  // shows its own white Cal.com attribution BELOW the box — book-a-call.tsx).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    // The section's glass box — the element carrying the dashed frame layer
    // whose width this drives. Falls back to our own box so a missing wrapper
    // can't null-crash the callback.
    const frame =
      box.closest<HTMLElement>("[data-book-a-call-box]") ?? box;

    let started = false;
    // Frame-tracking state (see the __dimensionChanged handler below): the
    // month view's height once learned, whether the visitor has navigated the
    // booker yet, the last iframe width seen, and whether the narrow card is up.
    let monthHeight: number | null = null;
    let navigated = false;
    let lastWidth: number | null = null;
    let compact = false;

    const start = () => {
      if (started) return;
      started = true;

      const ns = initCalNamespace(INLINE_NS);
      ns("inline", {
        elementOrSelector: box,
        calLink: CAL_LINK,
        config: CAL_BOOKING_CONFIG,
      });
      ns("ui", CAL_UI_CONFIG);
      // Once the booker has fully loaded, flip to the "ready" layout: the
      // loading min-height comes off and the branding clip goes on (below).
      ns("on", {
        action: "linkReady",
        callback: () => setReady(true),
      });

      // ── Keep the glass frame on the card ────────────────────────────────
      // Cal reports only its HEIGHT across the origin boundary, so the card's
      // width can't be read from out here — but a height change is an exact
      // proxy for "the booker changed STEP". Measured against the live embed:
      // the month view holds ONE height across month navigation, duration
      // switches and day picks (none of which fire this event at all), while
      // stepping to the booking form does, and back again.
      //
      // So the whole job is knowing the month view's height, and it's LEARNED
      // rather than hard-coded — Cal reports its loading skeleton first (571)
      // and the real card ~330ms later (552), so the first value is a lie. The
      // rule that works: keep re-learning until the visitor first navigates,
      // because `__routeChanged` never fires during load — only a real
      // navigation produces one. Whatever we've learned by then IS the month
      // view. A resize while the calendar is still showing re-lays it out, so
      // that re-learns too.
      ns("on", {
        action: "__routeChanged",
        callback: () => {
          navigated = true;
        },
      });
      ns("on", {
        action: "__dimensionChanged",
        callback: (event: unknown) => {
          const next = dimension(event);
          if (!next) return;
          const resized =
            lastWidth != null &&
            Math.abs(next.width - lastWidth) > CAL_WIDTH_NOISE;
          lastWidth = next.width;
          if (!navigated || (!compact && resized)) monthHeight = next.height;
          compact =
            monthHeight != null && Math.abs(next.height - monthHeight) > 1;
          frame.style.setProperty(
            "--cal-frame-w",
            compact ? CAL_FORM_CARD_WIDTH : CAL_FULL_WIDTH,
          );
        },
      });
    };

    // Preload: boot as soon as the browser is idle after mount, so the
    // calendar is already rendered when the visitor scrolls to the section.
    // (setTimeout fallback: Safari still has no requestIdleCallback.)
    let idleId: number;
    let timeoutId: ReturnType<typeof setTimeout>;
    if ("requestIdleCallback" in window) {
      idleId = requestIdleCallback(start, { timeout: 2000 });
    } else {
      timeoutId = setTimeout(start, 200);
    }

    return () => {
      if ("cancelIdleCallback" in window) cancelIdleCallback(idleId!);
      clearTimeout(timeoutId!);
      // Clear the injected iframe so Fast Refresh / route changes don't stack
      // embeds into the same box.
      if (box) box.innerHTML = "";
      frame.style.removeProperty("--cal-frame-w");
    };
  }, []);

  return (
    <div
      ref={boxRef}
      // Cal's iframe fills this; before it loads (and behind it), a faint
      // "loading" note keeps the box from reading as broken. The note MUST be
      // absolutely positioned: Cal appends its <cal-inline> as a SIBLING after
      // it, so a normal-flow placeholder that fills the box pushes the embed
      // below the parent's overflow-hidden clip — an invisible calendar. And
      // because Cal's embed page keeps a TRANSPARENT body, the embed itself is
      // lifted (relative z-10) so the note can't ghost through the calendar.
      // The -mb clip: in its WIDE layout Cal renders a branding footer INSIDE
      // the iframe, 80px below the booker card (measured: card 471.5, iframe
      // 552 — and 80px at the slots and booking-form steps too). It can't be
      // recolored cross-origin, so the embed is pulled up by that strip and the
      // parent box's overflow-hidden crops it; the white Cal.com credit below
      // the box replaces it.
      //
      // ONLY in the wide layout. Below ~768px Cal switches the booker to its
      // stacked layout and DROPS the branding — the card then fills the iframe
      // exactly (measured across month / slots / form: strip 0–0.9px). So an
      // unconditional -80px cropped 80px of real calendar off phones, which is
      // what this @container query fixes.
      //
      // Keyed to the BOX's width, not the viewport's, because the box IS the
      // iframe's viewport — that's the width Cal lays itself out against, and
      // it stops the rule quietly breaking if the section's column ever changes.
      // 769 is measured, not Tailwind's `md`: at a box of exactly 768 Cal is
      // already stacked, and 768 is iPad-portrait width, so the off-by-one is
      // a real device rather than a hypothetical. Re-measure both numbers if
      // Cal restyles the booker.
      className={`relative size-full [&_cal-inline]:relative [&_cal-inline]:z-10 [&_iframe]:rounded-[18px] ${
        ready
          ? "@min-[769px]:[&_cal-inline]:-mb-[80px]"
          : "min-h-[563px] max-md:min-h-[70svh]"
      }`}
    >
      {!ready && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-body font-light text-white/50">
          loading the calendar…
        </p>
      )}
    </div>
  );
}

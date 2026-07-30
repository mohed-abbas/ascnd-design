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
 */

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

    let started = false;

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
      // The -mb clip: Cal renders its branding footer INSIDE the iframe, ~80px
      // below the booker card (measured: card 471.5px, iframe 552px). It can't
      // be recolored cross-origin, so once ready the embed is pulled up by that
      // strip and the parent box's overflow-hidden crops it; the white Cal.com
      // credit below the box replaces it. Re-measure if Cal restyles the strip.
      className={`relative size-full [&_cal-inline]:relative [&_cal-inline]:z-10 [&_iframe]:rounded-[18px] ${
        ready
          ? "[&_cal-inline]:-mb-[80px]"
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

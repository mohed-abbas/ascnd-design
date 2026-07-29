"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The Cal.com inline booking embed that fills the section's glass box
 * (Figma 746:4550).
 *
 * WHY THE VANILLA INLINE LOADER (not @calcom/embed-react): the site avoids
 * runtime dependencies for third-party widgets, so this uses Cal's official
 * inline-embed snippet — it injects app.cal.com/embed/embed.js ONCE and queues
 * commands — ported into a typed helper so we control exactly WHEN it loads.
 *
 * LOADING: the embed boots on MOUNT (deferred to idle so it never competes
 * with the page's first paint) rather than lazily on approach — a deliberate
 * trade: /pricing exists to get the call booked, so by the time the visitor
 * scrolls to the section the calendar must already be sitting there loaded.
 *
 * THEME: pinned to Cal's LIGHT theme, always. Without an explicit `theme`,
 * Cal's booker follows the visitor's OS prefers-color-scheme — a dark-mode
 * device got a dark calendar over the bright day sky. The embed deliberately
 * does NOT follow the site's sky mode either (one stable white calendar
 * across sunrise/day/sunset/night); `cssVarsPerTheme` pushes the brand
 * accent, mirroring the config generated in the Cal.com dashboard.
 */

// "<cal-username>/<event-type-slug>". Env override for previews/staging.
const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK ?? "ascndd/intro-session";

// Namespace scoping this embed instance (lets Cal keep multiple embeds apart).
// Matches the namespace in the dashboard-generated snippet for this event.
const NS = "intro-session";

// The brand accent pushed into Cal's UI — the sky-tint blue configured on the
// ascnd Cal.com event (dashboard snippet), used for selected dates / buttons.
const BRAND = "#9EC8FC";

type CalApi = ((...args: unknown[]) => void) & {
  loaded?: boolean;
  ns?: Record<string, CalApi>;
  q?: unknown[];
};

declare global {
  interface Window {
    Cal?: CalApi;
  }
}

/**
 * Cal's official inline-embed bootstrap (faithful port of their snippet): defines
 * window.Cal as a command queue, injecting embed.js on first use. Idempotent —
 * safe to call on every scroll-in; only the first injects the script.
 */
function ensureCal(): CalApi {
  const w = window;
  if (!w.Cal) {
    const queue = function (api: CalApi, args: IArguments | unknown[]) {
      (api.q ??= []).push(args);
    };
    const cal = function (this: unknown, ...args: unknown[]) {
      const c = w.Cal as CalApi;
      if (!c.loaded) {
        c.ns = {};
        c.q = c.q || [];
        document.head
          .appendChild(document.createElement("script"))
          .setAttribute("src", "https://app.cal.com/embed/embed.js");
        c.loaded = true;
      }
      if (args[0] === "init") {
        const api = function (this: unknown, ...a: unknown[]) {
          queue(api as unknown as CalApi, a);
        } as unknown as CalApi;
        const namespace = args[1];
        api.q = api.q || [];
        if (typeof namespace === "string") {
          c.ns![namespace] = c.ns![namespace] || api;
          queue(c.ns![namespace], args);
          queue(c, ["initNamespace", namespace]);
        } else queue(c, args);
        return;
      }
      queue(c, args);
    } as CalApi;
    w.Cal = cal;
  }
  return w.Cal;
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

    let started = false;

    const start = () => {
      if (started) return;
      started = true;

      const Cal = ensureCal();
      Cal("init", NS, { origin: "https://app.cal.com" });
      const ns = Cal.ns![NS];
      ns("inline", {
        elementOrSelector: box,
        calLink: CAL_LINK,
        config: {
          layout: "month_view",
          // Pin the LIGHT theme here, in the booker's boot config — the
          // later ui() call alone loses to the device's prefers-color-scheme
          // (a dark-mode phone rendered a dark calendar over the day sky).
          theme: "light",
          // Cal's dashboard snippet ships this as a string, not a boolean.
          useSlotsViewOnSmallScreen: "true",
        },
      });
      ns("ui", {
        theme: "light",
        cssVarsPerTheme: { light: { "cal-brand": BRAND } },
        hideEventTypeDetails: false,
        layout: "month_view",
      });
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

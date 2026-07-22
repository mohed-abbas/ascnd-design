"use client";

import { useEffect, useRef } from "react";

/**
 * The Cal.com inline booking embed that fills the section's glass box
 * (Figma 746:4550).
 *
 * WHY THE VANILLA INLINE LOADER (not @calcom/embed-react): the site avoids
 * runtime dependencies for third-party widgets, so this uses Cal's official
 * inline-embed snippet — it injects app.cal.com/embed/embed.js ONCE and queues
 * commands — ported into a typed helper so we control exactly WHEN it loads.
 *
 * House-rules alignment (this is third-party content, not one of our render
 * loops, but the perf ethos still applies): the embed script + iframe are
 * LAZY-LOADED. An IntersectionObserver holds off until the box is ~1 viewport
 * away, so a visitor who never scrolls this far never pays for Cal's script or
 * iframe. SSR renders the empty box (this is a client component mounted into it),
 * so there's no hydration cost either.
 *
 * THEME: Cal's booking page has a preset base theme, but the embed `ui` config
 * lets us push our brand in — `theme` (light, matching the day sky) and
 * `cssVarsPerTheme` for the brand accent. This seeds the fuller theming pass
 * (see the sky-mode palette in lib/theme) — for now it pins the accent to the
 * site's dark ink so selected dates / buttons read on-brand.
 *
 * ⚠️ CAL_LINK is a PLACEHOLDER until the real ascnd booking link is wired — set
 * NEXT_PUBLIC_CAL_LINK ("<username>/<event-slug>") to resolve a live calendar.
 */

// "<cal-username>/<event-type-slug>". Override in env; placeholder otherwise.
const CAL_LINK = process.env.NEXT_PUBLIC_CAL_LINK ?? "ascnd/intro";

// Namespace scoping this embed instance (lets Cal keep multiple embeds apart).
const NS = "book-a-call";

// The brand accent pushed into Cal's UI. #263138 is the site's dark ink (used for
// solid-CTA text) — a neutral, on-brand accent for the light day sky.
const BRAND = "#263138";

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

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    let started = false;

    const start = () => {
      if (started) return;
      started = true;

      const Cal = ensureCal();
      Cal("init", NS, { origin: "https://cal.com" });
      const ns = Cal.ns![NS];
      ns("inline", {
        elementOrSelector: box,
        calLink: CAL_LINK,
        layout: "month_view",
      });
      ns("ui", {
        theme: "light",
        cssVarsPerTheme: { light: { "cal-brand": BRAND } },
        hideEventTypeDetails: false,
        layout: "month_view",
      });
    };

    // Lazy: only boot Cal once the box is within ~1 viewport of the fold.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          start();
          io.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(box);

    return () => {
      io.disconnect();
      // Clear the injected iframe so Fast Refresh / route changes don't stack
      // embeds into the same box.
      if (box) box.innerHTML = "";
    };
  }, []);

  return (
    <div
      ref={boxRef}
      // Cal's iframe fills this; before it loads (and behind it), a faint
      // "loading" note keeps the box from reading as broken.
      className="size-full min-h-[563px] [&_iframe]:rounded-[18px] max-md:min-h-[70dvh]"
    >
      <p className="pointer-events-none flex size-full min-h-[563px] items-center justify-center text-body font-light text-white/50 max-md:min-h-[70dvh]">
        loading the calendar…
      </p>
    </div>
  );
}

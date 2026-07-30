"use client";

import { useEffect } from "react";
import {
  CAL_UI_CONFIG,
  POPUP_NS,
  initCalNamespace,
} from "@/lib/cal/embed";

/**
 * Boots the Cal.com POPUP namespace for every `<BookCallButton>` on the page
 * (components/ui/book-call-button.tsx). Renders nothing.
 *
 * Those buttons are declarative — they carry `data-cal-link` /
 * `data-cal-namespace` / `data-cal-config`, and embed.js's own delegated click
 * listener opens the modal. This provider exists for the two things that
 * listener can't do for itself:
 *   1. embed.js has to already be LOADED when the click lands, or no listener
 *      exists yet and the click is simply lost. So the script is warmed ahead of
 *      time rather than on demand — same preload-on-idle trade the inline
 *      calendar makes (cal-embed.tsx): a booking CTA that needs a 90KB script
 *      round-trip before it responds reads as broken.
 *   2. The namespace must be `init`ed before any click: embed.js THROWS
 *      ("Namespace … isn't defined") on a `data-cal-namespace` it doesn't know.
 *
 * Mounted once at the root (app/layout.tsx) rather than per section, since the
 * modal CTAs are spread across the homepage (hero, pricing card, closing CTA).
 * The `[data-cal-link]` probe is what keeps every OTHER route from paying for
 * the script: /pricing books through its inline calendar, which boots itself
 * (cal-embed.tsx), so this provider finds no buttons there and no-ops — and 404
 * / error pages never touch Cal at all. The probe runs at idle, i.e. after
 * hydration, so all server-rendered CTAs are already in the DOM by then. A CTA
 * that only mounts later, behind an interaction, would need its own boot — none
 * does today.
 */
export default function CalProvider() {
  useEffect(() => {
    let idleId: number;
    let timeoutId: ReturnType<typeof setTimeout>;
    let started = false;

    const start = () => {
      if (started) return;
      started = true;
      // Nothing on this route can open the modal — don't fetch embed.js.
      // Two markers, one per kind of booking surface: `data-cal-link` is the
      // declarative <BookCallButton> (Cal's own listener opens it) and
      // `data-cal-booking` is the nav/footer link that opens it from an onClick
      // instead (ui/book-call-link.tsx). Cal only ever reads the former, so the
      // marker can't trip its listener.
      if (!document.querySelector("[data-cal-link], [data-cal-booking]")) return;
      initCalNamespace(POPUP_NS)("ui", CAL_UI_CONFIG);
    };

    // Warm as soon as the browser is idle after mount, so the script is in place
    // before anyone reaches a CTA — and never in competition with first paint.
    // (setTimeout fallback: Safari still has no requestIdleCallback.)
    if ("requestIdleCallback" in window) {
      idleId = requestIdleCallback(start, { timeout: 3000 });
    } else {
      timeoutId = setTimeout(start, 400);
    }

    return () => {
      if ("cancelIdleCallback" in window) cancelIdleCallback(idleId!);
      clearTimeout(timeoutId!);
    };
  }, []);

  return null;
}

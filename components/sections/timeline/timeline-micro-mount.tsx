"use client";

/**
 * Runs the timeline's four in-card micro-loops on the PHONE composition.
 *
 * The desktop stage gets them from TimelineReveal, which also owns the scrubbed
 * spine draw and the pin. Below md that whole apparatus is skipped — there is no
 * spine and no pin — but the beats' own loops are the character of the section,
 * so they run here instead, against <TimelineMobile/>'s root.
 *
 * Renders null; it exists only for the effect's lifecycle.
 */

import { useEffect, useLayoutEffect } from "react";
import { initTimelineMicro } from "./timeline-micro";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
// Keep in step with timeline.tsx's `md:` switch and timeline-reveal.tsx.
const SMALL_SCREEN = "(max-width: 768px)";

export default function TimelineMicroMount() {
  useIsomorphicLayoutEffect(() => {
    // Found by attribute rather than a ref so timeline.tsx can stay a Server
    // Component — it renders no client hooks of its own today, and adding one
    // purely to pass this element down would pull the whole composition
    // (and its imagery) into the client bundle.
    const root = document.querySelector<HTMLElement>("[data-tl-mobile]");
    if (!root) return;
    // Above md the mobile composition is display:none and the stage is live, so
    // TimelineReveal is driving these same loops on its own copy of the nodes.
    // Two drivers on one animation would be bad enough; here they'd also be
    // measuring a hidden box, so this side simply stands down.
    if (!window.matchMedia(SMALL_SCREEN).matches) return;
    // Same contract as every other reveal on the site: reduced motion gets the
    // finished markup, which is what these widgets already render at rest.
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    let cancelled = false;
    let stop: (() => void) | undefined;
    const start = () => {
      if (cancelled) return;
      stop = initTimelineMicro(root);
    };
    // Behind fonts.ready for the same reason TimelineReveal is: the progress
    // chip measures both of its labels to tween its width between them, and a
    // measurement taken against a fallback face sticks for the session.
    if (!document.fonts || document.fonts.status === "loaded") start();
    else document.fonts.ready.then(start);

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return null;
}

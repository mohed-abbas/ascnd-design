"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

// useLayoutEffect on the client (park the split before paint if already in view
// on load); falls back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * "not sure which fits? talk to us." reveal (Figma 746:4592) — the same shared
 * scroll-in the FAQ / plan-comparison headings use: SplitText blur-rises the
 * mixed-font heading word by word, the subhead fades up a beat later, and the
 * calendar box settles in behind them. One-shot on enter.
 *
 * Renders nothing — drives [data-book-a-call-head] / -sub / -box.
 *
 * House rules: rides GSAP's shared ticker (LenisProvider), one-shot so it idles
 * to zero, and SSR / no-JS / reduced-motion render the FINISHED section — pieces
 * are hidden only once we know we'll animate, and the split is deferred until
 * fonts resolve so it measures the real glyph metrics.
 */
export default function BookACallReveal() {
  useIsomorphicLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-book-a-call]");
    if (!section) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const head = section.querySelector<HTMLElement>("[data-book-a-call-head]");
    const sub = section.querySelector<HTMLElement>("[data-book-a-call-sub]");
    const box = section.querySelector<HTMLElement>("[data-book-a-call-box]");
    if (!head) return;

    let ctx: gsap.Context | undefined;
    let split: SplitText | undefined;
    let cancelled = false;

    // Hide the animated pieces synchronously (before fonts resolve) so no
    // finished-state flash shows if the page loads already scrolled here.
    const hidden = [head, sub, box].filter(
      (el): el is HTMLElement => el != null,
    );
    gsap.set(hidden, { autoAlpha: 0 });

    const build = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        split = new SplitText(head, { type: "words" });
        gsap.set(head, { autoAlpha: 1 }); // container shown; words parked below

        const tl = gsap.timeline({
          scrollTrigger: { trigger: section, start: "top 80%", once: true },
        });

        tl.fromTo(
          split.words,
          { yPercent: 40, autoAlpha: 0, filter: "blur(8px)" },
          {
            yPercent: 0,
            autoAlpha: 1,
            filter: "blur(0px)",
            duration: 0.7,
            ease: "power3.out",
            stagger: 0.06,
            clearProps: "filter",
          },
          0,
        );

        if (sub) {
          tl.fromTo(
            sub,
            { autoAlpha: 0, y: 12 },
            { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" },
            0.2,
          );
        }

        // The calendar box blur-rises in — same de-frost as the FAQ / comparison
        // shells. clearProps drops the entrance filter so the resting box (which
        // hosts the Cal iframe) carries no lingering per-frame cost.
        if (box) {
          tl.fromTo(
            box,
            { y: 30, autoAlpha: 0, filter: "blur(10px)" },
            {
              y: 0,
              autoAlpha: 1,
              filter: "blur(0px)",
              duration: 0.8,
              ease: "power3.out",
              clearProps: "filter",
            },
            0.3,
          );
        }
      }, section);
    };

    // Defer until fonts are ready so SplitText measures the real glyph metrics
    // (Product Sans + Instrument Serif) — otherwise words mis-measure on swap.
    if (!document.fonts || document.fonts.status === "loaded") build();
    else document.fonts.ready.then(build);

    return () => {
      cancelled = true;
      ctx?.revert(); // kills the timeline + its ScrollTrigger, unwraps the split
      split?.revert();
      // Drop the pre-build hide so the resting layout shows if we never built.
      gsap.set(hidden, { clearProps: "opacity,visibility" });
    };
  }, []);

  return null;
}

"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

// useLayoutEffect on the client (park the reveal before paint if the section is
// already in view on load); falls back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * "simple pricing" scroll reveal (Figma node 469:680). One-shot on enter:
 *
 *  HEADING — the same word-by-word blur-rise the cards + working-with headings
 *  use: SplitText splits the mixed-font "simple pricing, pause anytime" into
 *  words; each rises, fades in and clears from a soft blur, staggered. The
 *  supporting line settles a beat later.
 *
 *  BODY — the two plan cards lift in with a beat between them (subscription
 *  first, then the offset sprint card), the badge and connector arrow fade in,
 *  and the footer settles last.
 *
 * Renders nothing — drives the [data-pricing-*] nodes authored in pricing.tsx.
 *
 * House-rules compliance:
 * - Rides GSAP's shared ticker (LenisProvider) — no private rAF.
 * - IDLES TO ZERO: a single `once: true` timeline; nothing repaints after it
 *   plays or on a still page.
 * - SSR / no-JS / reduced-motion render the FINISHED layout (no hidden markup);
 *   elements (and the heading's split words) are hidden only once we know we'll
 *   animate, and the split is deferred until fonts resolve so it measures the
 *   real glyph metrics.
 */
export default function PricingReveal() {
  useIsomorphicLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-pricing]");
    if (!section) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const head = section.querySelector<HTMLElement>("[data-pricing-head]");
    const sub = section.querySelector<HTMLElement>("[data-pricing-sub]");
    const cards = gsap.utils.toArray<HTMLElement>("[data-pricing-card]", section);
    const badge = section.querySelector<HTMLElement>("[data-pricing-badge]");
    const arrow = section.querySelector<HTMLElement>("[data-pricing-arrow]");
    const arrowBrush = section.querySelector<SVGPathElement>("[data-pricing-arrow-brush]");
    const arrowHead = section.querySelector<SVGPathElement>("[data-pricing-arrow-head]");
    const foot = gsap.utils.toArray<HTMLElement>("[data-pricing-foot]", section);
    if (!head || cards.length === 0) return;

    let ctx: gsap.Context | undefined;
    let split: SplitText | undefined;
    let cancelled = false;

    // Hide the animated pieces synchronously (before fonts resolve) so no
    // finished-state flash shows if the page loads already scrolled here.
    const hidden = [head, sub, ...cards, badge, arrow, ...foot].filter(
      (el): el is HTMLElement => el != null,
    );
    gsap.set(hidden, { autoAlpha: 0 });

    const build = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        split = new SplitText(head, { type: "words" });
        gsap.set(head, { autoAlpha: 1 }); // container shown; words parked below

        const tl = gsap.timeline({
          scrollTrigger: { trigger: section, start: "top 75%", once: true },
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
            { autoAlpha: 1, y: 0, duration: 0.7, ease: "power2.out" },
            0.3,
          );
        }

        // The two plan cards blur-rise in, same as the cards-section glass
        // shells: each parks below + fogged (foreground blur) and de-frosts to
        // crisp, subscription first then the offset sprint. clearProps drops the
        // entrance filter so only each card's own backdrop-blur remains at rest.
        tl.fromTo(
          cards,
          { y: 36, autoAlpha: 0, filter: "blur(10px)" },
          {
            y: 0,
            autoAlpha: 1,
            filter: "blur(0px)",
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.14,
            clearProps: "filter",
          },
          0.35,
        );

        // Badge fades in.
        if (badge) {
          tl.fromTo(
            badge,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.7, ease: "power2.out" },
            0.7,
          );
        }

        // The connector DRAWS on instead of fading: reveal the (empty-masked) SVG,
        // wipe the brush's stroke-dashoffset 1→0 so the dashes trace from the badge
        // down the path, then pop the arrowhead as the line lands. Markup default
        // is fully drawn, so this parks it empty first (immediateRender).
        if (arrow) tl.set(arrow, { autoAlpha: 1 }, 0.7);
        if (arrowBrush) {
          // Park the mask brush empty (offset 1 = nothing revealed), then ramp it
          // to 0 to wipe the reveal along the path from the badge to the arrowhead.
          // Driven through a proxy + onUpdate rather than tweening the SVG property
          // directly: GSAP won't interpolate `strokeDashoffset` on this masked node
          // (it snaps 1→0, so the line just appears) — writing the style each frame
          // ramps it smoothly and the mask re-renders per frame.
          arrowBrush.style.strokeDashoffset = "1";
          const draw = { o: 1 };
          tl.to(
            draw,
            {
              o: 0,
              duration: 0.85,
              ease: "power1.inOut",
              onUpdate: () => {
                arrowBrush.style.strokeDashoffset = String(draw.o);
              },
            },
            0.7,
          );
        }
        // Arrowhead simply fades in at its fixed spot as the line lands — no
        // scale/transform (which had it settling off-position); it sits exactly
        // where the drawn tail ends.
        if (arrowHead) {
          tl.fromTo(
            arrowHead,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.22, ease: "power2.out" },
            1.4,
          );
        }

        // Footer settles last.
        tl.fromTo(
          foot,
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.7, ease: "power2.out" },
          0.9,
        );
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

"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { FOOTER_GLASS, useFooterGlassEligible } from "./footer-glass-config";

gsap.registerPlugin(ScrollTrigger);

// useLayoutEffect on the client (park the scene before paint if it's already in
// view on load); falls back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Footer-scene reveal (Figma 539:466) — the closing mountain range. It rises a
 * touch, fades in and clears from a soft blur to crisp, once, as the footer
 * scrolls in — the same blur-rise FAMILY the section headings use, applied to the
 * [data-footer-scene] box.
 *
 * This is the entrance for the FALLBACK / no-reveal paths. When the live glass runs
 * WITH its in-scene reveal (footer-glass-config: eligible && glassReveal), that
 * reveal owns the entrance (mountains up, glass rising a beat later) — so this box
 * blur-rise steps aside to avoid double-animating the canvas.
 *
 * Renders nothing — drives [data-footer-scene].
 *
 * House-rules compliance: rides GSAP's shared ticker (LenisProvider), one-shot so
 * it idles to zero (the filter is cleared at the end — no lingering per-frame
 * blur), and SSR / no-JS / reduced-motion render the FINISHED scene (no hidden
 * markup) — it's hidden only once we know we'll animate.
 */
export default function FooterReveal() {
  const eligible = useFooterGlassEligible();

  useIsomorphicLayoutEffect(() => {
    // The live glass's in-scene reveal owns the entrance — don't also blur-rise.
    if (eligible && FOOTER_GLASS.glassReveal) return;

    const section = document.querySelector<HTMLElement>("[data-footer]");
    if (!section) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const scene = section.querySelector<HTMLElement>("[data-footer-scene]");
    if (!scene) return;

    // Hide the scene synchronously so no finished-state flash shows if the page
    // loads already scrolled to the footer.
    gsap.set(scene, { autoAlpha: 0 });

    const ctx = gsap.context(() => {
      gsap.fromTo(
        scene,
        { autoAlpha: 0, yPercent: 4, filter: "blur(10px)" },
        {
          autoAlpha: 1,
          yPercent: 0,
          filter: "blur(0px)",
          duration: 0.9,
          ease: "power3.out",
          clearProps: "filter",
          // clamp(): on mobile the footer box is short (max-md aspect override,
          // footer.tsx) and the page ends BEFORE its top can reach 70% of the
          // viewport — unclamped, the trigger sits past max scroll, never fires,
          // and the pre-hidden scene stays invisible. Clamping pulls the start
          // back inside the scrollable range (fires at page end); desktop's
          // natural 70% point is in range, so its timing is unchanged.
          scrollTrigger: { trigger: section, start: "clamp(top 70%)", once: true },
        }
      );
    }, section);

    return () => {
      ctx.revert(); // kills the tween + its ScrollTrigger
      // Drop the pre-build hide so the resting scene shows if we never animated.
      gsap.set(scene, { clearProps: "opacity,visibility" });
    };
  }, [eligible]);

  return null;
}

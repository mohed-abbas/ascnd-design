"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// useLayoutEffect on the client (arms the start state before paint, no flash);
// falls back to useEffect during SSR. Mirrors the other *-reveal drivers.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Footer wordmark reveal — the giant "ascnd" logo rises into place while its
 * blur clears to crisp, echoing the tagline's blur-rise. Because the rocks paint
 * ON TOP of the wordmark (see footer.tsx DOM order), the logo's left/right ends
 * emerge from behind the cliffs as it rises — the immersion effect. Renders
 * nothing.
 *
 * ONE-SHOT (not scrubbed like the tagline) BY NECESSITY: this is the last
 * section, so at max scroll the footer only comes flush to the viewport bottom —
 * its top never clears the viewport and the wordmark's top only reaches
 * `vh − 516px`. A scrub keyed to a scroll position past that (as the tagline's
 * "end: top -10%" is) can never resolve on a tall viewport, so the blur would
 * stick forever. A fixed-duration play triggered on enter always completes,
 * whatever the viewport height. It fires once and stays revealed.
 *
 * House rules: rides the shared Lenis/GSAP ticker (one loop, pumped by
 * lenis-provider.tsx), plays once then idles to zero (and drops the blur filter
 * + will-change hint on completion, so nothing keeps compositing), and SSR /
 * no-JS / reduced-motion render the FINISHED logo — it's armed hidden (before
 * paint, in a layout effect) only when motion is allowed.
 */
export default function FooterReveal() {
  useIsomorphicLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-footer]");
    const mark = document.querySelector<HTMLElement>("[data-footer-wordmark]");
    if (!section || !mark) return;

    const mm = gsap.matchMedia();

    // Reduced motion resting state is the CSS default (logo fully visible, no
    // transform/blur), so that branch is a no-op.
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Arm the start before paint: drop the logo below its resting spot, hide
      // it, and blur it. yPercent (not px) keeps the rise proportional as the
      // wordmark scales with the column width.
      gsap.set(mark, {
        yPercent: 45,
        autoAlpha: 0,
        filter: "blur(14px)",
        willChange: "transform, filter, opacity",
      });

      gsap.to(mark, {
        yPercent: 0,
        autoAlpha: 1,
        filter: "blur(0px)",
        duration: 1.1,
        ease: "power3.out",
        // Drop the blur filter + compositor hint once settled so the finished
        // logo carries no lingering per-frame cost.
        clearProps: "filter,willChange",
        scrollTrigger: {
          // Trigger on the section (stable — the wordmark itself is transformed
          // while armed, which would offset its own measured trigger point).
          trigger: section,
          start: "top 72%", // ~when the wordmark first rises into view
          once: true,
        },
      });
    });

    return () => mm.revert();
  }, []);

  return null;
}

"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(SplitText, ScrollTrigger);

// useLayoutEffect on the client (parks the split before paint if the section is
// already in view on load); falls back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * "everything that gets you up there" headline (Figma 371:8420) with the
 * staggered mixed-font layout — Instrument Serif "everything", Product Sans Bold
 * "that gets you up" (design's Black isn't self-hosted; see pills.tsx), Product
 * Sans Light "there". Each line is absolutely positioned inside a fixed-height,
 * whitespace-nowrap block so it reads as one editorial cluster.
 *
 * It blur-reveals WORD BY WORD (each word rises a touch, fades in, and clears
 * from a soft blur to crisp) when the section scrolls into view — the same
 * mechanic as the hero, cards and why-stay headings, matched here to
 * cards-heading.tsx's values (SplitText words, 0.7s / power3.out, 0.06 stagger).
 *
 * JS-/motion-gated: SSR, no-JS and reduced-motion render the finished heading
 * (no hidden state in the markup) — we only hide + park the glyphs once we know
 * we'll animate, then reveal on ScrollTrigger enter (once). The container keeps
 * its fixed 164px box while hidden (visibility, not display), so the CTA below
 * never jumps.
 */
export default function PillsHeading() {
  const ref = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    let split: SplitText | undefined;
    let ctx: gsap.Context | undefined;
    let cancelled = false;

    // Hide until the split is built so a resting-state heading can't flash if
    // the page loads already scrolled to this section.
    gsap.set(el, { autoAlpha: 0 });

    const build = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        // Split across all three lines; split.words comes back in DOM order
        // (everything → that → gets → you → up → there), so one stagger cascades
        // the whole cluster.
        split = new SplitText(el, { type: "words" });
        gsap.set(el, { autoAlpha: 1 }); // container shown; words parked below/blurred
        gsap.fromTo(
          split.words,
          { yPercent: 40, autoAlpha: 0, filter: "blur(8px)" },
          {
            yPercent: 0,
            autoAlpha: 1,
            filter: "blur(0px)",
            duration: 0.7,
            ease: "power3.out",
            stagger: 0.06,
            clearProps: "filter", // drop the inline filter once crisp
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          },
        );
      }, el);
    };

    // Defer until fonts are ready so SplitText measures the real glyph metrics
    // (Instrument Serif + Product Sans) — otherwise the words mis-measure on swap.
    if (!document.fonts || document.fonts.status === "loaded") build();
    else document.fonts.ready.then(build);

    return () => {
      cancelled = true;
      ctx?.revert(); // kills the tween + its ScrollTrigger, unwraps the split
      split?.revert();
      gsap.set(el, { clearProps: "opacity,visibility" }); // drop the pre-build hide
    };
  }, []);

  return (
    <div
      ref={ref}
      className="relative h-[164px] w-full whitespace-nowrap text-center text-white max-md:flex max-md:h-auto max-md:flex-col max-md:items-center max-md:whitespace-normal"
    >
      <p className="absolute left-[calc(50%-155.5px)] top-0 -translate-x-1/2 font-instrument text-display leading-[1.1] tracking-[-0.03em] max-md:static max-md:translate-x-0">
        everything
      </p>
      <p className="absolute left-[calc(50%+36.5px)] top-[50px] -translate-x-1/2 text-hero font-bold leading-[1.1] tracking-[-0.03em] max-md:static max-md:translate-x-0">
        that gets you up
      </p>
      <p className="absolute left-[calc(50%+113.5px)] top-[110px] -translate-x-1/2 text-display font-light leading-[1.1] tracking-[-0.03em] max-md:static max-md:translate-x-0">
        there
      </p>
    </div>
  );
}

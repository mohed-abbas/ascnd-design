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
 * Cards section heading (Figma 302:1446) — "ground to launch in days" with the
 * Instrument Serif "launch" accent, Product Sans Light. It rolls up character by
 * character (SplitText chars + mask, the same mechanic as the tagline/subscribe
 * card) when the section scrolls into view.
 *
 * JS-/motion-gated: SSR, no-JS and reduced-motion render the finished heading
 * (there's no hidden state in the markup) — we only hide + park the glyphs once
 * we know we'll animate, and reveal on ScrollTrigger enter (once). Positioned to
 * match the design: centred, 303px above the card-row centre.
 */
export default function CardsHeading() {
  const ref = useRef<HTMLHeadingElement>(null);

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
        split = new SplitText(el, { type: "chars", mask: "chars" });
        gsap.set(el, { autoAlpha: 1 }); // container shown; glyphs parked/masked
        gsap.fromTo(
          split.chars,
          { yPercent: 110 },
          {
            yPercent: 0,
            duration: 0.7,
            ease: "power3.out",
            stagger: 0.03,
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          },
        );
      }, el);
    };

    // Defer until fonts are ready so SplitText measures the real glyph metrics
    // (Product Sans + Instrument Serif) — otherwise the masks mis-clip on swap.
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
    <h2
      ref={ref}
      className="absolute left-1/2 top-[calc(50%_-_303px)] w-max -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center font-product text-[49px] font-light leading-[1.1] tracking-[-1.47px] text-white"
    >
      {"ground to "}
      <span className="font-instrument">launch</span>
      {" in days"}
    </h2>
  );
}

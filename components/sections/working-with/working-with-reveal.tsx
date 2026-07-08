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

// The "unfilled" and "filled" tones of the supporting copy (white 60% → 100%).
const DIM = "rgba(255,255,255,0.6)";
const LIT = "rgba(255,255,255,1)";

// Feathered fill front, expressed in the stagger tween's own units: each char
// starts STEP after the previous and takes SPAN to go dim→lit, so ~SPAN/STEP
// characters are mid-transition at once — that overlap IS the soft gradient edge.
// (Absolute values are irrelevant under scrub; only the SPAN:STEP ratio matters.)
const STEP = 1;
const SPAN = 8;

/**
 * "who you're working with" scroll motion (Figma node 423:412). Two independent
 * pieces:
 *
 *  HEADLINE (one-shot on enter) — the Product Sans words rise, fade and clear
 *  from a soft blur, staggered; the Instrument Serif "working" is excluded and
 *  lands a beat later with a longer settle + a lingering white glow, so the
 *  mixed-font word is the focal moment.
 *
 *  PARAGRAPH FILL (scrubbed) — the supporting copy renders two-tone (a lit lede,
 *  a dim "unfilled" continuation). As the section scrolls through, a feathered
 *  fill front sweeps the continuation from white/60 up to full white in reading
 *  order — the dim text "inks in". It's tied to scroll position, so scrolling
 *  back up un-fills it. The lit lede never changes; only the [data-ww-fill] span
 *  is swept.
 *
 * Renders nothing — drives the [data-ww-*] nodes authored in working-with.tsx.
 *
 * House-rules compliance:
 * - Rides GSAP's shared ticker (LenisProvider) — no private rAF; the scrub is
 *   pumped by ScrollTrigger.update off the one Lenis loop.
 * - IDLES TO ZERO: the headline is one-shot; the fill only recomputes while the
 *   user is actively scrolling the section — a still page repaints nothing.
 * - SSR / no-JS / reduced-motion render the FINISHED two-tone statement (no
 *   hidden markup); we only hide the headline words + split the fill once we
 *   know we'll animate.
 */
export default function WorkingWithReveal() {
  useIsomorphicLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-working-with]");
    if (!section) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const words = gsap.utils.toArray<HTMLElement>("[data-ww-word]", section);
    const serif = section.querySelector<HTMLElement>("[data-ww-serif]");
    const fill = section.querySelector<HTMLElement>("[data-ww-fill]");
    if (!words.length) return;

    // The Product Sans words minus the serif "working" (its own beat).
    const plainWords = words.filter((w) => w !== serif);

    let ctx: gsap.Context | undefined;
    let fillSplit: SplitText | undefined;
    let cancelled = false;

    // Hide the headline words synchronously (before fonts resolve) so a
    // finished-state flash can't show if the page loads already scrolled here.
    // The paragraph is NOT hidden — its dim two-tone IS the resting/base look.
    gsap.set(words, { autoAlpha: 0 });

    const build = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        // ── HEADLINE (one-shot on enter) ──────────────────────────────────
        const head = gsap.timeline({
          scrollTrigger: { trigger: section, start: "top 80%", once: true },
        });

        head.fromTo(
          plainWords,
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

        if (serif) {
          head
            .fromTo(
              serif,
              { yPercent: 40, autoAlpha: 0, scale: 0.94, filter: "blur(12px)" },
              {
                yPercent: 0,
                autoAlpha: 1,
                scale: 1,
                filter: "blur(0px)",
                duration: 0.95,
                ease: "power3.out",
                clearProps: "filter,transform",
              },
              0.18,
            )
            .fromTo(
              serif,
              { textShadow: "0 0 20px rgba(255,255,255,0.7)" },
              {
                textShadow: "0 0 0px rgba(255,255,255,0)",
                duration: 1.2,
                ease: "power2.out",
                clearProps: "textShadow",
              },
              "<0.15",
            );
        }

        // ── PARAGRAPH FILL (scrubbed) ─────────────────────────────────────
        // Split the dim continuation into chars and sweep their colour dim→lit
        // in reading order, tied to scroll. chars come back in DOM order, so the
        // stagger runs left→right, line by line. `inline-block` (SplitText's
        // default) breaks only at the preserved spaces, so wrapping is intact.
        const para = section.querySelector<HTMLElement>("[data-ww-para]");
        if (fill && para) {
          fillSplit = new SplitText(fill, { type: "chars" });
          gsap.fromTo(
            fillSplit.chars,
            { color: DIM },
            {
              color: LIT,
              ease: "none",
              duration: SPAN,
              stagger: { each: STEP, from: "start" },
              // Anchored to the PARAGRAPH (not the section) and completed at
              // `top 55%` — this is the last, full-viewport section, so the
              // scroll floor pins its centre at ~48% viewport; ending any higher
              // would strand the final characters unfilled. `top 90%→55%` keeps
              // the whole sweep on-screen and finishes with scroll room to spare.
              scrollTrigger: {
                trigger: para,
                start: "top 90%",
                end: "top 55%",
                scrub: true,
              },
            },
          );
        }
      }, section);
    };

    // Defer until fonts are ready so SplitText measures the real glyph metrics
    // (Instrument Serif + Product Sans) — otherwise chars mis-measure on swap.
    if (!document.fonts || document.fonts.status === "loaded") build();
    else document.fonts.ready.then(build);

    return () => {
      cancelled = true;
      ctx?.revert(); // kills both timelines + their ScrollTriggers
      fillSplit?.revert(); // restores the continuation's original text nodes
      // Drop the pre-build hide so the resting headline shows if we never built.
      gsap.set(words, { clearProps: "opacity,visibility" });
    };
  }, []);

  return null;
}

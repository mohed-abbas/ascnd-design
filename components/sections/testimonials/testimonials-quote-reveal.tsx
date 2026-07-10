"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { QUOTE_CYCLE_SECS, TESTIMONIALS } from "./testimonials-data";

gsap.registerPlugin(ScrollTrigger, SplitText);

// useLayoutEffect on the client (park the split before paint if the quote is
// already in view on load); falls back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// Word-by-word blur-rise — the same recipe the section headings use
// (comparison-reveal.tsx). One constant so the initial reveal and every cycle
// swap read identically.
const WORD_IN = {
  from: { yPercent: 40, autoAlpha: 0, filter: "blur(8px)" },
  to: {
    yPercent: 0,
    autoAlpha: 1,
    filter: "blur(0px)",
    duration: 0.7,
    ease: "power3.out",
    stagger: 0.06,
    clearProps: "filter",
  },
} as const;

// The exit: current words lift away with a quick fade + blur, then the next
// quote plays WORD_IN. Faster and tighter-staggered than the entrance so the
// swap reads as one gesture, not two equal animations.
const WORD_OUT = {
  yPercent: -30,
  autoAlpha: 0,
  filter: "blur(6px)",
  duration: 0.35,
  ease: "power2.in",
  stagger: 0.02,
} as const;

/** Rebuild the quote markup for testimonial i (mirrors testimonials.tsx). */
function quoteMarkup(i: number) {
  return TESTIMONIALS[i].quote
    .map(
      (seg) =>
        `<span${seg.serif ? ' class="font-instrument"' : ""}>${seg.text}</span>`,
    )
    .join("");
}

/**
 * Testimonials pull-quote reveal + rotation. The initial scroll-in plays the
 * same word-by-word blur-rise the section headings use (see
 * comparison-reveal.tsx); after it lands, the quote CYCLES through
 * TESTIMONIALS every QUOTE_CYCLE_SECS — current words lift out (WORD_OUT), the
 * next quote swaps in and plays the same entrance (WORD_IN), looping forever.
 *
 * Renders nothing — drives [data-testimonials-quote], whose SSR content is
 * TESTIMONIALS[0]; the driver re-renders the same segment markup for the rest.
 *
 * Anchored to the QUOTE element, not the section: the section is min-h-dvh with
 * the quote centred in it, so a section-top trigger would run the reveal while
 * the quote is still below the fold. "top 80%" plays it as the quote actually
 * enters view — a beat ahead of the rocks flying in.
 *
 * House-rules compliance: the 5s clock is a gsap.delayedCall (shared ticker —
 * no setInterval/private rAF) and is PAUSED while the section is off-screen
 * (ScrollTrigger toggle), so the cycle idles to zero out of view; an in-flight
 * swap tween (~1s) is allowed to finish. SSR / no-JS / reduced-motion render
 * the finished first quote — glyphs are hidden only once we know we'll animate.
 */
export default function TestimonialsQuoteReveal() {
  useIsomorphicLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-testimonials]");
    if (!section) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const quote = section.querySelector<HTMLElement>(
      "[data-testimonials-quote]",
    );
    if (!quote) return;

    const originalHTML = quote.innerHTML; // restored on teardown
    let split: SplitText | undefined;
    let inTween: gsap.core.Tween | undefined;
    let outTween: gsap.core.Tween | undefined;
    let timer: gsap.core.Tween | undefined; // the 5s delayedCall
    let st: ScrollTrigger | undefined;
    let viewST: ScrollTrigger | undefined;
    let cancelled = false;
    let inView = false;
    let idx = 0;

    // Hide the quote synchronously, before fonts resolve, so no finished-state
    // flash shows if the page loads already scrolled here.
    gsap.set(quote, { autoAlpha: 0 });

    // Hold the current quote for 5s (only while the section is on screen —
    // the clock pauses off-screen and resumes where it left off), then swap.
    const armTimer = () => {
      timer?.kill();
      timer = gsap.delayedCall(QUOTE_CYCLE_SECS, swap);
      if (!inView) timer.pause();
    };

    const playIn = () => {
      if (cancelled) return;
      split?.revert();
      split = new SplitText(quote, { type: "words" });
      inTween = gsap.fromTo(split.words, WORD_IN.from, {
        ...WORD_IN.to,
        onComplete: armTimer,
      });
    };

    const swap = () => {
      if (cancelled || !split) return;
      outTween = gsap.to(split.words, {
        ...WORD_OUT,
        onComplete: () => {
          if (cancelled) return;
          idx = (idx + 1) % TESTIMONIALS.length;
          split?.revert();
          quote.innerHTML = quoteMarkup(idx);
          playIn();
        },
      });
    };

    const build = () => {
      if (cancelled) return;
      gsap.set(quote, { autoAlpha: 1 }); // container shown; words park below
      // Initial reveal on scroll-in (once); the cycle starts when it lands.
      st = ScrollTrigger.create({
        trigger: quote,
        start: "top 80%",
        once: true,
        onEnter: playIn,
      });
      // Pause/resume the hold clock with section visibility (idle to zero).
      viewST = ScrollTrigger.create({
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => {
          inView = self.isActive;
          if (!timer) return;
          if (inView) timer.play();
          else timer.pause();
        },
      });
      // Words are parked hidden until the trigger fires.
      split = new SplitText(quote, { type: "words" });
      gsap.set(split.words, WORD_IN.from);
    };

    // Defer until fonts are ready so SplitText measures the real glyph metrics
    // (Product Sans + Instrument Serif) — otherwise words mis-measure on swap.
    if (!document.fonts || document.fonts.status === "loaded") build();
    else document.fonts.ready.then(build);

    return () => {
      cancelled = true;
      st?.kill();
      viewST?.kill();
      timer?.kill();
      inTween?.kill();
      outTween?.kill();
      split?.revert();
      quote.innerHTML = originalHTML; // back to the SSR quote
      gsap.set(quote, { clearProps: "opacity,visibility" });
    };
  }, []);

  return null;
}

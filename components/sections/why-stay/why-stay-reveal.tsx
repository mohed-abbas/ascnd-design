"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { makeCappedInvalidate } from "@/lib/perf/capped-invalidate";
import { PER_PHRASE, PHRASES, REEL_STEP } from "./why-stay-data";

gsap.registerPlugin(ScrollTrigger);

// useLayoutEffect on the client (arms the start state before paint, no flash);
// falls back to useEffect during SSR. Mirrors the other *-reveal drivers.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// ── Scroll ranges (tune live) ───────────────────────────────────────────────
const ENTER_START = "top 85%"; // heading/pill begin revealing as the section rises
const ENTER_END = "top top"; // fully formed exactly as the section locks to the top
// PER_PHRASE (px of scroll per phrase while pinned) lives in why-stay-data.ts —
// shared with the static cloud layer's why-stay conveyor.
const SCRUB = 0.8; // scroll-follow smoothing; higher = more glide/inertia
const REEL_EASE = "sine.inOut"; // reel eases in/out so it's near-still at the pin edges

// ── Timeline proportions (scrubbed → only the ratios matter) ────────────────
const HEAD_DUR = 0.6; // per-word blur-reveal duration
const HEAD_STAGGER = 0.1; // gap between heading words
const HEAD_RISE = 40; // yPercent each word starts below its resting line
const HEAD_BLUR_FROM = "blur(8px)"; // soft start blur, clears to crisp
const HEAD_BLUR_TO = "blur(0px)";
const PILL_DUR = 0.7; // pill fade-in
const ROLL_EASE = "power3.out"; // heading roll-up ease

/**
 * "why teams stay" pinned orchestrator. Renders nothing. On mount it builds two
 * scroll-scrubbed drivers over the section:
 *   1. ENTRANCE (not pinned) — as the section rises into view the heading blur-
 *      reveals word by word and the glass pill fades in, finishing exactly as the
 *      section top reaches the viewport top.
 *   2. PIN — the section then locks to the viewport (`pin: true`) and continued
 *      scrolling scrubs the reel SMOOTHLY and linearly through every phrase (one
 *      continuous glide, no dwell) by animating a single inherited `--reel-y`
 *      (px) that the reel column translates by. When the last phrase lands the
 *      pin releases and the page scrolls on.
 *
 * SCRUBBED: both are tied to scroll position, so they play forward on the way in
 * and reverse on the way out with no fixed duration. Because `scrub` reads the
 * true scroll position, a load parked mid-section resolves to the correct
 * progress with no on-load flash.
 *
 * Pinning is safe against the fixed-sky constraint (CLAUDE.md): the section is a
 * root-level sibling of <Background/>/<CloudLayer/>, never an ancestor, so
 * position:fixed during the pin doesn't turn the sky into a backdrop root.
 *
 * Resting state: CSS defaults `--reel-y` to 0 (first phrase centred) and leaves
 * the heading / pill / lens visible, so SSR / no-JS / reduced-motion render a
 * legible, static section — with no pin. `gsap.matchMedia` arms the hidden start
 * and builds the pin only under `no-preference` and reverts everything on
 * unmount. ScrollTrigger updates are already pumped by the global Lenis rAF
 * (lenis-provider.tsx) — one loop.
 */
export default function WhyStayReveal() {
  useIsomorphicLayoutEffect(() => {
    const section = document.querySelector<HTMLElement>("[data-whystay]");
    if (!section) return;

    const stage = section.querySelector<HTMLElement>("[data-whystay-stage]");
    const pill = section.querySelector<HTMLElement>("[data-whystay-pill]");
    const words = gsap.utils.toArray<HTMLElement>("[data-whsword]");
    if (!stage) return;

    const N = PHRASES.length;
    const mm = gsap.matchMedia();

    // Reduced motion: first phrase centred, everything at rest (--reel-y:0 is the
    // CSS default; set it explicitly so a mid-section load can't inherit a stale
    // armed value from a prior no-preference mount).
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(stage, { "--reel-y": "0px" });
    });

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Arm the hidden start before paint: reel at the first phrase, heading
      // words dropped + faded + blurred, pill invisible.
      gsap.set(stage, { "--reel-y": "0px" });
      if (words.length)
        gsap.set(words, {
          yPercent: HEAD_RISE,
          autoAlpha: 0,
          filter: HEAD_BLUR_FROM,
        });
      if (pill) gsap.set(pill, { autoAlpha: 0, scale: 0.96 });

      // 1) Entrance (not pinned) — the glass pill fades/scales in while the
      //    heading blur-reveals, tied to the section's approach so it's fully formed
      //    exactly as the section top reaches the viewport top.
      const enterTl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: ENTER_START,
          end: ENTER_END,
          scrub: SCRUB,
          invalidateOnRefresh: true,
        },
      });
      if (pill)
        enterTl.to(
          pill,
          { autoAlpha: 1, scale: 1, duration: PILL_DUR, ease: "power2.out" },
          0,
        );
      if (words.length)
        enterTl.to(
          words,
          {
            yPercent: 0,
            autoAlpha: 1,
            filter: HEAD_BLUR_TO,
            duration: HEAD_DUR,
            ease: ROLL_EASE,
            stagger: HEAD_STAGGER,
          },
          0,
        );

      // 2) Pin — lock the section to the viewport and scrub the reel through
      //    every phrase (one continuous glide, no dwell), then release so the
      //    page scrolls on. A sine.inOut ease keeps the reel near-still right at
      //    the lock and release, so the pin feels soft rather than snapping into
      //    and out of motion. Pin distance scales with the phrase count.
      //
      //    The CSS var is written through a capped, snapped writer instead of
      //    tweening it directly (docs/why-stay-glass-optimization.md O5): every
      //    --reel-y change moves the reel BEHIND the glass pill, forcing its
      //    whole backdrop displacement chain to re-evaluate. Tweened directly,
      //    that ran at scroll-event rate (120/s on a fast panel) and kept
      //    emitting sub-pixel deltas while the scrub eased to rest. Snapping to
      //    device pixels dedupes the invisible writes, and makeCappedInvalidate
      //    (the cloud canvases' throttle) caps the rest at heavyEffectFpsCap()
      //    with a trailing write, so a scrub can never park one frame stale.
      const reel = { y: 0 };
      let lastWritten = 0;
      const writeReel = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const snapped = Math.round(reel.y * dpr) / dpr;
        if (snapped === lastWritten) return;
        lastWritten = snapped;
        stage.style.setProperty("--reel-y", `${snapped}px`);
      };
      const cappedWrite = makeCappedInvalidate(writeReel);
      gsap.to(reel, {
        y: -(N - 1) * REEL_STEP,
        ease: REEL_EASE,
        onUpdate: cappedWrite,
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: `+=${PER_PHRASE * (N - 1)}`,
          pin: true,
          // No anticipatePin: with Lenis' smoothed velocity it fires the lock a
          // few px early and snaps the section into place (a harsh landing).
          // Lenis already bounds frame-to-frame scroll deltas, so the plain pin
          // engages exactly when the section top reaches the top — a smooth
          // settle with no jump.
          scrub: SCRUB,
          invalidateOnRefresh: true,
        },
      });

      // Drop a pending trailing write on media-query change / unmount (the
      // gsap.set arming above owns the var's reset).
      return () => cappedWrite.cancel();
    });

    return () => mm.revert();
  }, []);

  return null;
}

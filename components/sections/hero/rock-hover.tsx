"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { INTRO_REVEAL_EVENT, introWillPlay } from "@/components/sections/intro/intro-state";

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const REVEAL_SIZE = 340; // diameter (px) of the soft reveal disc
const FOLLOW = 0.18; // pointer-follow lerp factor per 60 Hz frame (lower = more lag)
const BASE_FRAME_MS = 1000 / 60; // the frame length FOLLOW was tuned against

/**
 * Drives the grass-rock hover reveal. Renders nothing; on mount it tracks the
 * pointer over the hero and feeds the [data-grass-overlay] mask four px-unit CSS
 * vars (--reveal-x/y/size/half) that globals.css turns into a feathered radial
 * disc. We write the vars with explicit "px" units (Next's Lightning CSS pipeline
 * mangles unitless `calc(var() * 1px)`, so units must come from JS), and smooth
 * the follow with a lerp on GSAP's ticker — the same ticker Lenis already drives,
 * so there's no second rAF loop. The ticker is only attached while interacting.
 *
 * Mouse-only (no hover on touch) and disabled under prefers-reduced-motion, so
 * the overlay stays fully masked-out and only the bare cliffs show.
 *
 * When the welcome intro plays, the hover stays dormant until the glass docks
 * (INTRO_REVEAL_EVENT) — otherwise hovering the rocks region mid-intro would
 * reveal grass over the still-parked cliffs (see the wire/unwire gate below).
 */
export default function RockHover() {
  useEffect(() => {
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const hero = document.querySelector<HTMLElement>("[data-hero]");
    const overlay = document.querySelector<HTMLElement>("[data-grass-overlay]");
    if (!hero || !overlay) return;

    // Disc state we animate, and the cursor target the disc eases toward.
    const state = { x: -9999, y: -9999, size: 0 };
    const target = { x: -9999, y: -9999 };
    let active = false; // disc currently open
    let primed = false; // disc snapped onto the cursor since the last enter
    let running = false; // ticker attached

    const apply = () => {
      overlay.style.setProperty("--reveal-x", `${state.x}px`);
      overlay.style.setProperty("--reveal-y", `${state.y}px`);
      overlay.style.setProperty("--reveal-size", `${state.size}px`);
      overlay.style.setProperty("--reveal-half", `${state.size / 2}px`);
    };

    // Frame-rate-independent follow (audit H3): a raw `* FOLLOW` per tick
    // converges ~2× faster at 120 Hz than at 60. Exponential-decay correction
    // keeps the chase speed identical at any refresh rate — GSAP's ticker
    // hands us the frame's deltaTime (ms) as the second argument.
    const tick = (_time: number, deltaTime: number) => {
      const k = 1 - Math.pow(1 - FOLLOW, deltaTime / BASE_FRAME_MS);
      state.x += (target.x - state.x) * k;
      state.y += (target.y - state.y) * k;
      apply();
    };

    const start = () => {
      if (running) return;
      running = true;
      gsap.ticker.add(tick);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      gsap.ticker.remove(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = hero.getBoundingClientRect();
      target.x = e.clientX - rect.left;
      target.y = e.clientY - rect.top;

      // Snap the disc onto the cursor before it first opens, so it grows in
      // place rather than easing in from its last (or off-screen) position.
      if (!primed) {
        state.x = target.x;
        state.y = target.y;
        primed = true;
        apply();
        // Un-hide the overlay on first interaction: it mounts at opacity-0 so
        // Chrome's LCP heuristic (which ignores opacity:0 but NOT mask-hidden
        // paint) never counts the invisible lazy grass as the page's LCP — see
        // the LCP note in grass-rocks.tsx. Mask still hides everything outside
        // the disc, so this flip has no visible effect. Idempotent on re-enter.
        overlay.style.opacity = "1";
      }
      start();
      if (!active) {
        active = true;
        gsap.to(state, {
          size: REVEAL_SIZE,
          duration: 0.45,
          ease: "power2.out",
          overwrite: true,
        });
      }
    };

    const onLeave = () => {
      active = false;
      primed = false;
      gsap.to(state, {
        size: 0,
        duration: 0.4,
        ease: "power2.out",
        overwrite: true,
        onComplete: stop, // idle: drop the ticker until the next enter
      });
    };

    const wire = () => {
      hero.addEventListener("pointermove", onMove);
      hero.addEventListener("pointerleave", onLeave);
    };
    const unwire = () => {
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
    };

    // While the welcome intro plays, the DOM cliffs are parked invisible but the
    // grass overlay is always mounted (only the reveal disc masks it). If we wired
    // the hover now, moving over the rocks region would open the disc and float a
    // chunk of grass cliff over the still-playing WebGL scene. So mirror
    // rock-reveal.tsx: hold off until the glass docks (INTRO_REVEAL_EVENT), when
    // the real cliffs exist for the disc to reveal.
    let stopWaiting: (() => void) | undefined;
    if (introWillPlay()) {
      const onReveal = () => wire();
      window.addEventListener(INTRO_REVEAL_EVENT, onReveal, { once: true });
      stopWaiting = () =>
        window.removeEventListener(INTRO_REVEAL_EVENT, onReveal);
    } else {
      wire();
    }

    return () => {
      stopWaiting?.();
      unwire();
      gsap.killTweensOf(state);
      stop();
    };
  }, []);

  return null;
}

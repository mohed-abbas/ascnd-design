"use client";

import { useEffect } from "react";
import gsap from "gsap";

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const REVEAL_SIZE = 340; // diameter (px) of the soft reveal disc
const FOLLOW = 0.18; // pointer-follow lerp factor per frame (lower = more lag)

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

    const tick = () => {
      state.x += (target.x - state.x) * FOLLOW;
      state.y += (target.y - state.y) * FOLLOW;
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

    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);

    return () => {
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      gsap.killTweensOf(state);
      stop();
    };
  }, []);

  return null;
}

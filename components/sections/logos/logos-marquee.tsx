"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";

// useLayoutEffect on the client (sets up before paint, no flash); falls back to
// useEffect during SSR to avoid React's server warning. Mirrors rock-reveal.tsx
// and design-shots-reveal.tsx.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const SPEED = 40; // px/sec — a calm, constant drift regardless of row width

/**
 * Infinite logos marquee. Renders nothing; on mount it turns the static
 * `[data-logos-track]` (one `[data-logos-group]` of brand wordmarks, see
 * logos.tsx) into a seamless leftward scroll.
 *
 * Seamlessness without a measured-percentage guess: we clone the group until
 * the track is at least one viewport + one group wide, then translate the track
 * left by exactly one group's advance (group width + the flex gap). Because
 * every group is identical and equally spaced, the frame at x = -advance is
 * pixel-identical to the frame at x = 0, so the `repeat: -1` restart is
 * invisible — and the extra clones guarantee the viewport stays filled at the
 * wrap point. Speed is constant px/sec (duration scales with the advance), so
 * the drift looks the same no matter how wide the wordmarks render.
 *
 * Width is measured after `document.fonts.ready` (Aeonik → Product Sans Bold
 * fallback would otherwise reflow the row and break the seam) and rebuilt on
 * resize. If the page isn't armed (no-JS) or the user prefers reduced motion we
 * bail and CSS leaves the single group centred under the edge-fade mask.
 */
export default function LogosMarquee() {
  useIsomorphicLayoutEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-hero]");
    if (!root) return;

    const track = root.querySelector<HTMLElement>("[data-logos-track]");
    const source = track?.querySelector<HTMLElement>("[data-logos-group]");
    const viewport = track?.parentElement;
    if (!track || !source || !viewport) return;

    if (
      !document.documentElement.classList.contains("reveal-armed") ||
      window.matchMedia(REDUCE_MOTION).matches
    ) {
      return;
    }

    let cancelled = false;
    let tween: gsap.core.Tween | undefined;
    let visible = true; // whether the marquee row is on screen (idle-gate)

    // (Re)build the marquee: strip any prior clones, clone the source group to
    // fill the viewport (+ one spare group for the wrap), then run the loop.
    const build = () => {
      tween?.kill();
      gsap.set(track, { x: 0 });
      track.querySelectorAll("[data-logos-clone]").forEach((n) => n.remove());

      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const advance = source.offsetWidth + gap; // one group's worth of travel
      if (advance <= gap) return; // not laid out yet — nothing to animate

      // Enough copies that, after shifting left by one advance, the remaining
      // groups still cover the full viewport (no empty gap at the seam).
      const needed = Math.ceil((viewport.offsetWidth + advance) / advance) + 1;
      for (let i = 1; i < needed; i++) {
        const clone = source.cloneNode(true) as HTMLElement;
        clone.setAttribute("data-logos-clone", "");
        track.appendChild(clone);
      }

      // Left-anchor the track (the static fallback centres it) so x=0 is the
      // true start of the loop.
      viewport.style.justifyContent = "flex-start";

      tween = gsap.to(track, {
        x: -advance,
        duration: advance / SPEED,
        ease: "none",
        repeat: -1,
      });
      // A rebuild while the row is off-screen shouldn't silently resume it.
      if (!visible) tween.pause();
    };

    // Measure once fonts are settled so the cloned widths are final.
    document.fonts?.ready.then(() => {
      if (!cancelled) build();
    });

    // Viewport width changes how many clones are needed to stay filled.
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!cancelled) build();
      });
    };
    window.addEventListener("resize", onResize);

    // Idle-gate: the marquee lives in the hero, so once it scrolls out of view
    // there's no reason to keep the infinite tween (and its live composited
    // layer) running — every other loop on the site already pauses off-screen.
    // The loop is seamless (frame at x=0 ≡ frame at x=-advance), so pausing and
    // resuming at any point is invisible.
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) tween?.play();
      else tween?.pause();
    });
    io.observe(viewport);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      io.disconnect();
      tween?.kill();
      track.querySelectorAll("[data-logos-clone]").forEach((n) => n.remove());
      gsap.set(track, { x: 0 });
      viewport.style.justifyContent = "";
    };
  }, []);

  return null;
}

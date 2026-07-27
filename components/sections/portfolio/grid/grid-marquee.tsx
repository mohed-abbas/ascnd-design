"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";

// useLayoutEffect on the client (tweens exist before paint, so the wall never
// shows one static frame then jumps), plain useEffect during SSR so React
// doesn't warn. Same idiom as logos-marquee.tsx and the section reveals.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** How long a hovered column takes to come to rest, and to pick back up. */
const PAUSE_EASE = 0.4;

/**
 * GridMarquee — the portfolio wall's infinite drift and its hover pause
 * (docs/portfolio-grid-mode.md steps 2–3). Renders NOTHING: on mount it finds
 * the static wall portfolio-grid.tsx laid out and turns each column into a
 * seamless loop, exactly as logos-marquee.tsx does for the hero's logo row.
 *
 * SEAMLESSNESS WITHOUT A MEASURED GUESS — the mechanic is logos-marquee's,
 * turned 90°. Clone each column's group until the track is at least one
 * viewport + one group tall, then translate the track by exactly ONE group's
 * advance (its offsetHeight + the flex gap). Every group is identical and
 * equally spaced, so the frame at y = -advance is pixel-identical to the frame
 * at y = 0 and the `repeat: -1` restart is invisible; the spare clones keep the
 * viewport covered at the wrap.
 *
 * Each column measures its OWN advance, which is the point: tile heights are
 * the authored aspects and nothing is padded to match (D9), so columns are
 * unequal heights and — at a constant px/sec — loop at different periods. They
 * desync for free. Never pad a column to match another; that would remove the
 * effect this feature exists for.
 *
 * DIRECTION. A falling column can't just translate downward from 0: at y = 0
 * its first tile is already at the top of the viewport, so falling would drag
 * empty space in behind it. It starts at y = -advance (one group's worth of
 * tiles parked ABOVE the viewport) and travels to 0. Rising columns are the
 * plain 0 → -advance case.
 *
 * HOVER PAUSE (D4) — hovering a column eases THAT column's `timeScale` to 0;
 * its neighbours keep drifting. A tween of timeScale rather than `.pause()`
 * because a wall of images stopping dead reads as a stall, while a 0.4s ramp
 * reads as the thing paying attention to you. Pointer events, so a pen works
 * and a finger does not (there is no hover on touch — a phone just keeps
 * drifting, which is the intended mobile behaviour).
 *
 * HOUSE-RULES COMPLIANCE (heavy-effect contract, CLAUDE.md):
 *  - Rides the shared ticker: GSAP tweens run on gsap.ticker, which
 *    LenisProvider already drives. No private rAF, no second scheduler.
 *  - Idles to zero off-screen: an IntersectionObserver pauses every tween when
 *    the wall leaves the viewport. The loop is seamless, so pausing and
 *    resuming at an arbitrary point is invisible.
 *  - Transform only: one `y` per column per frame, on a promoted layer. Nothing
 *    here touches layout, and `will-change` sits on the TRACK, never on a tile
 *    (per-tile promotion multiplies layer memory by the tile count for nothing).
 *  - Tier: no knob to read — see the registry note in lib/perf/tiers.ts.
 *
 * Reduced motion is NOT handled yet, deliberately: degradation is a later pass
 * (CLAUDE.md "feature first, degrade later", and §11 of the record).
 */
export default function GridMarquee({ rebuildKey }: { rebuildKey: string }) {
  useIsomorphicLayoutEffect(() => {
    const viewport = document.querySelector<HTMLElement>("[data-portfolio-grid]");
    if (!viewport) return;

    const columns = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-grid-column]"),
    );
    if (columns.length === 0) return;

    let disposed = false;
    let visible = false; // starts false — nothing runs until the IO confirms
    const tweens: gsap.core.Tween[] = [];
    const cleanups: (() => void)[] = [];

    // (Re)build every column: strip prior clones, clone the group until the
    // track overfills, then start the loop.
    const build = () => {
      tweens.forEach((t) => t.kill());
      tweens.length = 0;
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;

      const viewportHeight = viewport.clientHeight;

      columns.forEach((column) => {
        const track = column.querySelector<HTMLElement>("[data-grid-track]");
        const group = track?.querySelector<HTMLElement>("[data-grid-group]");
        if (!track || !group) return;

        gsap.set(track, { y: 0 });
        track.querySelectorAll("[data-grid-clone]").forEach((n) => n.remove());

        const gap = parseFloat(getComputedStyle(track).rowGap) || 0;
        const advance = group.offsetHeight + gap; // one group's worth of travel
        if (advance <= gap) return; // not laid out yet — nothing to animate

        const needed = Math.ceil((viewportHeight + advance) / advance) + 1;
        for (let i = 1; i < needed; i++) {
          const clone = group.cloneNode(true) as HTMLElement;
          clone.setAttribute("data-grid-clone", "");
          // The clones are duplicated CONTENT, not additional work: without
          // this a screen reader reads the portfolio three times over, and
          // once tiles become focusable (the expand, step 5) the tab order
          // would walk the same project repeatedly. Same reason the footer's
          // roll-hover clone is hidden.
          clone.setAttribute("aria-hidden", "true");
          track.appendChild(clone);
        }

        const direction = Number(column.dataset.driftDirection ?? 1);
        const speed = Number(column.dataset.driftSpeed ?? 30);
        const falling = direction > 0;

        const tween = gsap.fromTo(
          track,
          { y: falling ? -advance : 0 },
          {
            y: falling ? 0 : -advance,
            duration: advance / speed, // px/sec, so height doesn't change pace
            ease: "none",
            repeat: -1,
          },
        );
        if (!visible) tween.pause();
        tweens.push(tween);

        // Hover pause (D4) — this column only.
        const slow = () => gsap.to(tween, { timeScale: 0, duration: PAUSE_EASE });
        const resume = () =>
          gsap.to(tween, { timeScale: 1, duration: PAUSE_EASE });
        column.addEventListener("pointerenter", slow);
        column.addEventListener("pointerleave", resume);
        cleanups.push(() => {
          column.removeEventListener("pointerenter", slow);
          column.removeEventListener("pointerleave", resume);
          gsap.killTweensOf(tween);
        });
      });
    };

    build();

    // Width changes re-flow the columns (tile heights are a ratio of the column
    // width), which changes every advance — so the loop has to be rebuilt.
    // Height-only changes just alter how many clones are needed. rAF-coalesced
    // so a drag-resize costs one rebuild per frame at worst, not one per event.
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!disposed) build();
      });
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(viewport);

    // Idle-gate: no repainting a wall nobody is looking at.
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      tweens.forEach((t) => (visible ? t.play() : t.pause()));
    });
    io.observe(viewport);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      cleanups.forEach((fn) => fn());
      tweens.forEach((t) => t.kill());
      viewport
        .querySelectorAll("[data-grid-clone]")
        .forEach((n) => n.remove());
      viewport
        .querySelectorAll<HTMLElement>("[data-grid-track]")
        .forEach((track) => gsap.set(track, { y: 0 }));
    };
    // rebuildKey changes whenever the WALL ITSELF changes (filter → different
    // projects, breakpoint → different column count), which React renders as
    // entirely new column contents. Re-running is not an optimisation here: the
    // cloned nodes and the measured advances both belong to the old wall.
  }, [rebuildKey]);

  return null;
}

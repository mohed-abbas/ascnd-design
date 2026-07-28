"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";

// useLayoutEffect on the client so the armed (hidden) state exists BEFORE the
// browser paints — a passive effect would let the wall flash in at full opacity
// for a frame and then blink to zero. Plain useEffect during SSR so React does
// not warn. Same idiom as grid-marquee.tsx and the section reveals.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// ── The heading ──
const HEADING_SHIFT = 18; // px it rises through
const HEADING_DURATION = 0.7;

// ── The columns ──
/**
 * How far a column travels in. Deliberately larger than the heading's shift:
 * the columns are the wall arriving, the heading is just a line of type
 * settling. 56px is roughly one tile's mat + gap, so a column enters looking
 * like it is one step behind where it belongs rather than flying in from off.
 */
const COLUMN_SHIFT = 56;
const COLUMN_DURATION = 1;
const COLUMN_STAGGER = 0.09;
/** Columns start this long after the heading, so the two read as one gesture. */
const COLUMN_DELAY = 0.12;

const EASE = "power3.out";

/**
 * GridReveal — the portfolio wall's ENTRANCE. Renders nothing, the house pattern
 * (design-shots-reveal.tsx, rock-reveal.tsx, grid-marquee.tsx): it finds the wall
 * portfolio-grid.tsx laid out, arms it hidden, and plays it in when the section
 * first comes into view.
 *
 * It runs on MOUNT and on every REBUILD — the same `rebuildKey` the marquee
 * takes — so it is both the on-load entrance and the second half of a filter
 * swap. portfolio-swap.ts plays the outgoing wall out and then commits the new
 * filter; the new wall lands here and comes in. Neither side knows about the
 * other, which is why the exit lives with the state that defers and the entrance
 * lives with the DOM that arrives.
 *
 * WHAT MOVES, AND WHY IT IS ONLY FOUR ELEMENTS
 * The columns, not the tiles. A per-tile stagger is the obvious first idea and
 * it is the wrong one here: the marquee has already cloned every group two or
 * three times over, so "the tiles" is 50–70 nodes, each fading on its own
 * schedule — that is a lot of compositing for a section that has to share a
 * frame with the fixed sky and the cloud canvas. Four columns of opacity +
 * transform is the same visual idea for a fraction of the cost, and it matches
 * what the wall already animates in its steady state: one number per column.
 *
 * DIRECTION IS THE DRIFT'S. A column enters from the side it is travelling FROM
 * — a falling column (drift direction 1) drops in from above, a rising one comes
 * up from below — reading the same `data-drift-direction` the marquee does. So
 * the entrance decelerates straight into the loop instead of arriving from a
 * direction the wall then contradicts. The exit (portfolio-swap.ts) leaves the
 * other way, WITH the drift.
 *
 * The column carries the reveal transform; the TRACK inside it carries the
 * marquee's. Separate elements on purpose — they compose, and neither has to
 * know the other is running.
 *
 * GATED ON VISIBILITY. The portfolio sits deep in the page, so a reveal that
 * fired at mount would play to nobody and the visitor would scroll down to a
 * wall that was already there. An IntersectionObserver holds the timeline until
 * the wall is actually on screen, then disconnects — it is a one-shot, not the
 * marquee's idle gate. On a REBUILD the wall is on screen by definition (the
 * controls are inside the section), so the observer fires on its first callback
 * and the entrance is immediate.
 *
 * Reduced motion is NOT handled yet, deliberately — degradation is a later pass
 * (CLAUDE.md "feature first, degrade later"; docs/portfolio-grid-mode.md §11).
 */
export default function GridReveal({ rebuildKey }: { rebuildKey: string }) {
  // The heading animates on MOUNT only, never on a filter swap: the words
  // "stuff we've shipped" are not what changed, and re-fading them every time a
  // tab is pressed makes the header look unstable. A ref survives rebuildKey
  // changes (this component is not keyed, so it stays mounted across them) but
  // not a mode swap, which unmounts the whole wall — exactly the right scope.
  const first = useRef(true);

  useIsomorphicLayoutEffect(() => {
    const viewport = document.querySelector<HTMLElement>("[data-portfolio-grid]");
    if (!viewport) return;

    const columns = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-grid-column]"),
    );
    if (columns.length === 0) return;

    // The heading lives in the section header, OUTSIDE the wall — it belongs to
    // portfolio.tsx and is shared with globe mode (where it is sr-only). Queried
    // from the document rather than passed down, so the wall keeps owning its
    // own entrance without the section having to hand it a ref.
    const heading = first.current
      ? document.querySelector<HTMLElement>("[data-portfolio-heading]")
      : null;
    first.current = false;

    // paused, but the fromTo start values still apply on creation
    // (immediateRender) — which is the whole point of building it here in a
    // layout effect. The wall is hidden before the first paint and stays hidden
    // until the observer says it is worth playing.
    const timeline = gsap.timeline({ paused: true });

    if (heading) {
      timeline.fromTo(
        heading,
        { opacity: 0, y: HEADING_SHIFT },
        {
          opacity: 1,
          y: 0,
          duration: HEADING_DURATION,
          ease: EASE,
          // Hand the element back to CSS once it has landed, so nothing
          // downstream inherits an inline opacity it did not set.
          clearProps: "opacity,transform",
        },
        0,
      );
    }

    timeline.fromTo(
      columns,
      {
        opacity: 0,
        y: (_i, el: HTMLElement) =>
          Number(el.dataset.driftDirection ?? 1) > 0
            ? -COLUMN_SHIFT
            : COLUMN_SHIFT,
      },
      {
        opacity: 1,
        y: 0,
        duration: COLUMN_DURATION,
        ease: EASE,
        stagger: COLUMN_STAGGER,
        clearProps: "opacity,transform",
      },
      heading ? COLUMN_DELAY : 0,
    );

    let observer: IntersectionObserver | null = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer?.disconnect();
        observer = null;
        timeline.play();
      },
      // Fire a fifth of a viewport EARLY, and the reason is the heading rather
      // than the wall. The wall's box starts ~350px below the band's top, so
      // watching it un-margined means the heading — which is armed by the same
      // timeline — sits on screen and blank for the ~250px of scroll it takes
      // the columns to reach the fold. Reaching down closes that gap; reaching
      // further, or watching the section instead, would run the whole entrance
      // below the fold and the visitor would arrive at a wall already there.
      { rootMargin: "0px 0px 20% 0px" },
    );
    observer.observe(viewport);

    return () => {
      observer?.disconnect();
      timeline.kill();
      // Killing a timeline leaves whatever values it had reached, so an
      // interrupted reveal would strand its columns half-faded. The next build
      // re-arms them anyway, but a mode swap has no next build.
      gsap.set(columns, { clearProps: "opacity,transform" });
      if (heading) gsap.set(heading, { clearProps: "opacity,transform" });
    };
  }, [rebuildKey]);

  return null;
}

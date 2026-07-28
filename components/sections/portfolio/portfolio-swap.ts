"use client";

/**
 * The portfolio section's TRANSITIONS — how one wall becomes another, and how
 * one mode becomes the other.
 *
 * THE PROBLEM THIS SOLVES. React renders the truth: change the filter and the
 * old tiles are gone in the same frame the new ones arrive, change the mode and
 * a canvas is replaced by a wall between two paints. Both are correct and both
 * read as a glitch — the section is a body of work someone is browsing, and it
 * should hand things over rather than cut.
 *
 * There is no exit animation in React because there is no "about to unmount".
 * So the state is SPLIT IN TWO:
 *
 *   • the CONTROL value (portfolio.tsx `filter` / `mode`) — commits instantly,
 *     drives the pill, the aria-pressed and the highlight. A control that waits
 *     for an animation feels broken, so this one never waits.
 *   • the STAGED value (`useStagedSwap` below) — lags behind by exactly one exit
 *     animation, and is what the wall and the canvas actually render.
 *
 * The visitor gets an immediate answer from the control and a composed handover
 * from the content. The entrance is NOT here: the incoming wall plays itself in
 * from grid-reveal.tsx, keyed on the same rebuild key, so neither half has to
 * know the other exists.
 *
 * WHY THE TARGETS ARE DOM QUERIES rather than refs threaded down. The two modes
 * are mutually exclusive mounts with incompatible boxes — the wall is a `flex-1`
 * block below the header, the globe is `absolute inset-0` across the whole band
 * (portfolio.tsx). A shared wrapper to animate would have to be one or the
 * other and would break whichever it was not. Querying for whichever is mounted
 * costs one selector per swap and leaves both layouts alone. It is also how
 * every other motion component in this feature reaches its targets.
 *
 * Reduced motion is not handled yet, deliberately (CLAUDE.md "feature first,
 * degrade later").
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The wall leaving on a FILTER change.
 *
 * Shorter and sharper than the entrance (grid-reveal.tsx: 1s, power3.out): an
 * exit that lingers is dead time between a click and its answer, while an
 * entrance is the answer itself. `power2.in` accelerates away, so the columns
 * look pulled off rather than faded down.
 *
 * `shift` is smaller than the reveal's for the same reason — the columns only
 * have to commit to a direction, not travel.
 */
const WALL_EXIT = {
  duration: 0.34,
  ease: "power2.in",
  stagger: 0.035,
  shift: 40,
};

/** Either mode leaving on a MODE change. One element, so no stagger. */
const MODE_EXIT = { duration: 0.32, ease: "power2.in" };

/**
 * The globe arriving.
 *
 * The wall does not need a counterpart here — it brings its own entrance
 * (grid-reveal.tsx), and running a container fade UNDER that stagger would flatten
 * it into a single cross-fade. The canvas has no such thing: the engine's own
 * formation is a steady state, not an arrival, so without this the sphere pops
 * in at full strength the instant the mode commits.
 */
const SCENE_ENTER = { duration: 0.55, ease: "power2.out" };

/** Whichever mode is currently mounted, plus the heading it shares. */
const MODE_TARGETS = [
  "[data-portfolio-grid]",
  "[data-portfolio-globe]",
  "[data-portfolio-heading]",
];

function columns(): HTMLElement[] {
  return gsap.utils.toArray<HTMLElement>("[data-grid-column]");
}

function mounted(): HTMLElement[] {
  return MODE_TARGETS.map((selector) =>
    document.querySelector<HTMLElement>(selector),
  ).filter((el): el is HTMLElement => el !== null);
}

/**
 * Sweep the wall out in the direction each column is already drifting — the
 * mirror of the entrance, which comes in from the side each column drifts FROM.
 * Together they read as the wall being carried off and the next one carried in
 * on the same current.
 */
export function exitWall(): gsap.core.Animation | null {
  const cols = columns();
  if (cols.length === 0) return null;
  return gsap.to(cols, {
    opacity: 0,
    y: (_i, el: HTMLElement) =>
      Number(el.dataset.driftDirection ?? 1) > 0
        ? WALL_EXIT.shift
        : -WALL_EXIT.shift,
    duration: WALL_EXIT.duration,
    ease: WALL_EXIT.ease,
    stagger: WALL_EXIT.stagger,
    // A visitor clicking through three tabs quickly starts a new exit on top of
    // a running one; auto-overwrite lets the second tween take the columns from
    // wherever the first left them instead of the two fighting per-frame.
    overwrite: "auto",
  });
}

/** Put a wall back that never left — see `useStagedSwap`'s change-of-mind path. */
export function restoreWall(): void {
  const cols = columns();
  if (cols.length === 0) return;
  gsap.to(cols, {
    opacity: 1,
    y: 0,
    duration: WALL_EXIT.duration,
    ease: "power2.out",
    overwrite: "auto",
    // Hand the columns back to CSS. Without this an aborted swap leaves an
    // identity transform sitting on them for the rest of the session — inert,
    // but it makes each column a containing block for nothing.
    clearProps: "opacity,transform",
  });
}

/**
 * Fade out whichever mode is on screen. Only one of the two selectors can
 * match — they are mutually exclusive mounts — so this is "the current mode",
 * expressed without the section having to say which one that is.
 *
 * The heading rides along. It is not unmounted by a mode swap, it changes
 * between visible and `sr-only`, and letting it blink out under a fading wall
 * is the one part of the handover that would still cut. Tweening it while it is
 * sr-only (the globe's state) is invisible and harmless; grid-reveal.tsx sets it
 * from zero again the next time the wall mounts.
 */
export function exitMode(): gsap.core.Animation | null {
  const targets = mounted();
  if (targets.length === 0) return null;
  return gsap.to(targets, {
    opacity: 0,
    duration: MODE_EXIT.duration,
    ease: MODE_EXIT.ease,
    overwrite: "auto",
  });
}

/** Put a mode back that never left. */
export function restoreMode(): void {
  const targets = mounted();
  if (targets.length === 0) return;
  gsap.to(targets, {
    opacity: 1,
    duration: MODE_EXIT.duration,
    ease: "power2.out",
    overwrite: "auto",
    clearProps: "opacity",
  });
}

/** The globe's arrival. Returns a cleanup, so it can be used from an effect. */
export function enterScene(): () => void {
  const el = document.querySelector<HTMLElement>("[data-portfolio-globe]");
  if (!el) return () => {};
  const tween = gsap.fromTo(
    el,
    { opacity: 0 },
    {
      opacity: 1,
      duration: SCENE_ENTER.duration,
      ease: SCENE_ENTER.ease,
      clearProps: "opacity",
    },
  );
  return () => {
    tween.kill();
    gsap.set(el, { clearProps: "opacity" });
  };
}

/**
 * Hold `next` back until an exit animation has played, then commit it.
 *
 * @param next   the control value — commits instantly for the CONTROL, lags here
 * @param exit   plays the outgoing content out. Return `null` to commit with no
 *               animation at all, which is how a filter change in globe mode
 *               opts out: the engine already re-forms the sphere over ~1s of its
 *               own (cloud-canvas-engine.ts setFilter), and staging on top of
 *               that would blank the canvas before its own transition started.
 * @param restore undoes `exit` when the visitor changes their mind mid-flight.
 *
 * WHY THE COMMIT IS IN A LAYOUT EFFECT. The `null` path has to commit before
 * paint, or opting out of the animation would still cost a visible frame at the
 * old value — the abrupt swap this file exists to remove, made one frame later.
 */
export function useStagedSwap<T>(
  next: T,
  exit: () => gsap.core.Animation | null,
  restore: () => void,
): T {
  const [committed, setCommitted] = useState(next);
  // Read through refs so the callbacks always see the current render's closure
  // (exitWall's behaviour depends on the mode, which changes) without the
  // effect re-running every time the section re-renders. Refreshed in an effect
  // of their own rather than during render — writing a ref in the render body
  // is what react-hooks/refs forbids — and DECLARED FIRST so it lands before
  // the swap effect below reads them on the same commit.
  const exitRef = useRef(exit);
  const restoreRef = useRef(restore);
  useIsomorphicLayoutEffect(() => {
    exitRef.current = exit;
    restoreRef.current = restore;
  });

  // The exit currently in flight, if any. A ref rather than the effect's
  // cleanup: the effect re-runs when `committed` lands, and a cleanup there
  // would fire AFTER the incoming content's own layout effects have armed
  // it — stomping the entrance grid-reveal.tsx just set up.
  const flight = useRef<gsap.core.Animation | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (Object.is(next, committed)) {
      // Back to where we started while the exit was still running — pressing
      // "web designs" and then "all" again before the wall has left. Put the
      // content back rather than leaving it stranded half-gone: nothing is
      // going to re-render and re-arm it, because from React's side nothing
      // changed.
      if (flight.current) {
        flight.current.kill();
        flight.current = null;
        restoreRef.current();
      }
      return;
    }

    flight.current?.kill();
    const animation = exitRef.current();
    if (!animation) {
      flight.current = null;
      setCommitted(next);
      return;
    }

    flight.current = animation;
    animation.eventCallback("onComplete", () => {
      flight.current = null;
      setCommitted(next);
    });
  }, [next, committed]);

  // Unmount only. Anything still in flight is animating nodes that are about to
  // be torn down.
  useEffect(
    () => () => {
      flight.current?.kill();
    },
    [],
  );

  return committed;
}

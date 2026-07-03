"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import {
  INTRO_REVEAL_EVENT,
  introHasRevealed,
  introWillPlay,
} from "@/components/sections/intro/intro-state";

/**
 * The custom cursor's visual — the same white pointer arrow the cards use
 * (inlined from public/cards/cursor.svg, rotated -75deg + drop shadow),
 * following the real pointer with a slight trailing lag. The SVG is inlined (not
 * next/image) so it paints instantly with the DOM — a mouse-following cursor
 * must never wait on an async image fetch. No hover effect, no glass, no
 * per-frame filter (deliberately kept trivial so it can never become a GPU cost
 * the way the removed fluid/glass cursors did).
 *
 * The follow is EVENT-DRIVEN: each `pointermove` retargets a `gsap.quickTo`, so
 * the arrow EASES toward the pointer over FOLLOW seconds instead of snapping to
 * it. quickTo rides the SHARED GSAP ticker (LenisProvider's one loop — no
 * private rAF, per the heavy-effect contract) and settles to idle once caught
 * up: pointer still AND arrow arrived = zero per-frame work. The first move jumps
 * instantly (setX/setY) so the disc doesn't ease in from the top-left corner;
 * reduced-motion users keep the instant setter for every move (a trailing
 * cursor is motion). It fades in on the first move (we don't know the pointer
 * position until then) and hides when the pointer leaves the window / the tab
 * blurs so it can't get stuck in a corner. Through the welcome intro it's held
 * hidden (the native cursor is left visible) and only becomes eligible once
 * <Intro> docks — the same reveal cue the hero waits on.
 *
 * The element is `position:fixed`, `pointer-events:none`, mounted at the root
 * (cursor.tsx → layout.tsx), so it never intercepts clicks. Only mounted
 * client-side by the gate (SSR renders nothing → no hydration mismatch).
 */

// The pointer arrow matches the cards exactly: same asset, same -75deg rotation
// and drop shadow, rendered at its natural 25px.
const POINTER = 25;

// Hotspot — the offset of the image's top-left from the real pointer point so
// the arrow's TIP sits under the cursor location (not its centre). Derived from
// the tip vertex (18.63, 3.49 in the 25-unit art) rotated -75deg about the
// image centre → (-5.38, -4.25). Nudge if the tip drifts off the point.
const TIP_X = -5.38;
const TIP_Y = -4.25;

// The trailing lag: seconds the arrow takes to ease to the pointer. Small enough
// to read as a soft follow, not a laggy trail — tune to taste. power3 gives a
// quick start + gentle settle.
const FOLLOW = 0.2;
const FOLLOW_EASE = "power3";

export default function CursorVisual() {
  const outerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    // A trailing cursor is motion — reduced-motion users get the instant setter
    // for every move; everyone else gets the eased quickTo follow.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const setX = gsap.quickSetter(outer, "x", "px");
    const setY = gsap.quickSetter(outer, "y", "px");
    const xTo = gsap.quickTo(outer, "x", { duration: FOLLOW, ease: FOLLOW_EASE });
    const yTo = gsap.quickTo(outer, "y", { duration: FOLLOW, ease: FOLLOW_EASE });
    gsap.set(outer, { autoAlpha: 0 });

    // Stay OUT of the welcome intro: while the intro will play and hasn't docked
    // yet, the cursor is BLOCKED — the visual never fades in. A load with no
    // intro, or a mount after the dock, is eligible immediately.
    let introBlocking = introWillPlay() && !introHasRevealed();

    // Hide the native cursor only once the custom one is eligible (scoped to the
    // attribute in globals.css) — during the intro, and on touch / no-JS / SSR,
    // the native cursor stays. Deferred so the intro never runs cursorless.
    const activate = () => {
      document.documentElement.dataset.customCursor = "on";
    };
    if (!introBlocking) activate();

    let shown = false;
    let inside = false;
    const show = () => {
      if (introBlocking || shown) return;
      shown = true;
      gsap.to(outer, { autoAlpha: 1, duration: 0.2, ease: "power2.out" });
    };
    const hide = () => {
      shown = false;
      gsap.to(outer, { autoAlpha: 0, duration: 0.15, ease: "power2.in" });
    };

    let primed = false;
    const onMove = (e: PointerEvent) => {
      inside = true;
      if (!primed || reduce) {
        // First move jumps to the pointer (no ease-in from the corner);
        // reduced-motion snaps every move. quickTo picks up this position on its
        // first retarget below. This runs even while blocked, so the arrow's
        // position is already current the moment the intro releases it.
        primed = true;
        setX(e.clientX);
        setY(e.clientY);
      } else {
        xTo(e.clientX);
        yTo(e.clientY);
      }
      show();
    };
    const onLeave = () => {
      inside = false;
      hide();
    };
    const onVisibility = () => {
      if (document.hidden) onLeave();
    };
    // Intro docked → eligible now; if the pointer is already over the page fade
    // in at once (position tracked silently during the intro), else the next
    // move brings it in.
    const onIntroReveal = () => {
      introBlocking = false;
      activate();
      if (primed && inside) show();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    window.addEventListener("blur", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(INTRO_REVEAL_EVENT, onIntroReveal, { once: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(INTRO_REVEAL_EVENT, onIntroReveal);
      gsap.killTweensOf(outer);
      delete document.documentElement.dataset.customCursor;
    };
  }, []);

  return (
    <div
      ref={outerRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999]"
      style={{ willChange: "transform", visibility: "hidden" }}
    >
      {/* The cards' white pointer arrow (same path as public/cards/cursor.svg),
          inlined and anchored so its tip is on the point. */}
      <svg
        aria-hidden
        width={POINTER}
        height={POINTER}
        viewBox="0 0 25 25"
        fill="none"
        className="absolute [transform:rotate(-75deg)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
        style={{ left: TIP_X, top: TIP_Y }}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4.56517 12.785C2.64847 12.0169 2.69214 9.28859 4.63244 8.58221L18.6295 3.48652C20.4255 2.83266 22.1673 4.57443 21.5134 6.37048L16.4177 20.3675C15.7114 22.3078 12.9831 22.3514 12.215 20.4347L10.1458 15.2714C10.0695 15.0811 9.91877 14.9304 9.72856 14.8542L4.56517 12.785Z"
          fill="white"
        />
      </svg>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * The custom cursor's visual — a plain white disc that follows the pointer with
 * a slight trailing lag. No hover effect, no glass, no per-frame filter
 * (deliberately kept trivial so it can never become a GPU cost the way the
 * removed fluid/glass cursors did).
 *
 * The follow is EVENT-DRIVEN: each `pointermove` retargets a `gsap.quickTo`, so
 * the disc EASES toward the pointer over FOLLOW seconds instead of snapping to
 * it. quickTo rides the SHARED GSAP ticker (LenisProvider's one loop — no
 * private rAF, per the heavy-effect contract) and settles to idle once caught
 * up: pointer still AND disc arrived = zero per-frame work. The first move jumps
 * instantly (setX/setY) so the disc doesn't ease in from the top-left corner;
 * reduced-motion users keep the instant setter for every move (a trailing
 * cursor is motion). It fades in on the first move (we don't know the pointer
 * position until then) and hides when the pointer leaves the window / the tab
 * blurs so it can't get stuck in a corner.
 *
 * The element is `position:fixed`, `pointer-events:none`, mounted at the root
 * (cursor.tsx → layout.tsx), so it never intercepts clicks. Only mounted
 * client-side by the gate (SSR renders nothing → no hydration mismatch).
 */

const DOT = 14;

// The trailing lag: seconds the disc takes to ease to the pointer. Small enough
// to read as a soft follow, not a laggy trail — tune to taste. power3 gives a
// quick start + gentle settle.
const FOLLOW = 0.6;
const FOLLOW_EASE = "power3";

export default function CursorVisual() {
  const outerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    // Hide the native cursor only while this is live (scoped to the attribute in
    // globals.css) — touch / no-JS / SSR keep their native cursor.
    document.documentElement.dataset.customCursor = "on";

    // A trailing cursor is motion — reduced-motion users get the instant setter
    // for every move; everyone else gets the eased quickTo follow.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const setX = gsap.quickSetter(outer, "x", "px");
    const setY = gsap.quickSetter(outer, "y", "px");
    const xTo = gsap.quickTo(outer, "x", { duration: FOLLOW, ease: FOLLOW_EASE });
    const yTo = gsap.quickTo(outer, "y", { duration: FOLLOW, ease: FOLLOW_EASE });
    gsap.set(outer, { autoAlpha: 0 });

    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      gsap.to(outer, { autoAlpha: 1, duration: 0.2, ease: "power2.out" });
    };
    const hide = () => {
      shown = false;
      gsap.to(outer, { autoAlpha: 0, duration: 0.15, ease: "power2.in" });
    };

    let primed = false;
    const onMove = (e: PointerEvent) => {
      if (!primed || reduce) {
        // First move jumps to the pointer (no ease-in from the corner);
        // reduced-motion snaps every move. quickTo picks up this position on
        // its first retarget below.
        primed = true;
        setX(e.clientX);
        setY(e.clientY);
      } else {
        xTo(e.clientX);
        yTo(e.clientY);
      }
      show();
    };
    const onVisibility = () => {
      if (document.hidden) hide();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", hide);
    window.addEventListener("blur", hide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", hide);
      window.removeEventListener("blur", hide);
      document.removeEventListener("visibilitychange", onVisibility);
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
      {/* Solid white disc, centred on the point via negative margins. */}
      <span
        aria-hidden
        className="absolute left-0 top-0 rounded-full bg-white"
        style={{
          width: DOT,
          height: DOT,
          marginLeft: -DOT / 2,
          marginTop: -DOT / 2,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.18)",
        }}
      />
    </div>
  );
}

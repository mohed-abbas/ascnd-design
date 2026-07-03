"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * The custom cursor's visual — a plain white disc that follows the pointer.
 * No hover effect, no glass, no per-frame filter (deliberately kept trivial so
 * it can never become a GPU cost the way the removed fluid/glass cursors did).
 *
 * The follow is EVENT-DRIVEN: each `pointermove` writes ONE composited transform
 * (gsap.quickSetter → translate3d). Pointer still = no events = zero work; no rAF
 * loop exists. It fades in on the first move (we don't know the pointer position
 * until then) and hides when the pointer leaves the window / the tab blurs so it
 * can't get stuck in a corner.
 *
 * The element is `position:fixed`, `pointer-events:none`, mounted at the root
 * (cursor.tsx → layout.tsx), so it never intercepts clicks. Only mounted
 * client-side by the gate (SSR renders nothing → no hydration mismatch).
 */

const DOT = 14;

export default function CursorVisual() {
  const outerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    // Hide the native cursor only while this is live (scoped to the attribute in
    // globals.css) — touch / no-JS / SSR keep their native cursor.
    document.documentElement.dataset.customCursor = "on";

    const setX = gsap.quickSetter(outer, "x", "px");
    const setY = gsap.quickSetter(outer, "y", "px");
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

    const onMove = (e: PointerEvent) => {
      setX(e.clientX);
      setY(e.clientY);
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

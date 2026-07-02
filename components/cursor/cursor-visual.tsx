"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import GlassSurface from "@/components/ui/glass-surface";
import { getTierName, subscribeQuality } from "@/lib/perf/quality-store";

/**
 * The custom cursor's visual — a white disc that follows the pointer and, on
 * hover over an interactive element, grows and turns into a small liquid-glass
 * lens (the same <GlassSurface/> displacement used by the "why teams stay" pill).
 *
 * ── PERFORMANCE CONTRACT (CLAUDE.md "heavy-effect contract") ──────────────────
 * Cursors have been the page's dominant GPU cost twice (the removed curl-noise
 * trail + React Bits SplashCursor), so this is built to satisfy every rule:
 *
 * 1. No private rAF loop. The follow is EVENT-DRIVEN: each `pointermove` writes
 *    ONE composited transform (gsap.quickSetter → translate3d). Pointer still =
 *    no events = zero work. The only animation is the discrete hover morph, a
 *    short GSAP timeline on the shared ticker that completes and stops.
 * 2. Idles to zero. At rest the glass layer is `visibility:hidden` (autoAlpha 0),
 *    so its backdrop-filter is never evaluated — the displacement only runs while
 *    a hover morph is visible.
 * 3. Reads the quality tier. `low` (and prefers-reduced-motion) drop to the plain
 *    white disc — no glass, no morph. The glass itself is <GlassSurface/>, which
 *    carries its own tier gate + Firefox/Safari clear-glass fallback. Registered
 *    in lib/perf/tiers.ts (same-PR rule).
 * 4. SSR-stable. Only mounted client-side by the gate (cursor.tsx,
 *    useSyncExternalStore server snapshot `false`), so it never renders on the
 *    server — no hydration mismatch.
 * 5. dpr ≤ 1.5 (spirit). No canvas; the glass region is ~44px, so its device-res
 *    backdrop raster is negligible, and no raw devicePixelRatio is read.
 *
 * The element is `position:fixed`, `pointer-events:none`, mounted at the root
 * (no filter/backdrop-filter ancestor), so its fixed positioning + own
 * backdrop-filter behave (CLAUDE.md fixed-layer constraint).
 * ────────────────────────────────────────────────────────────────────────────
 */

// Rest disc + hover lens diameters (px).
const DOT = 14;
const LENS = 44;

// What turns the cursor to glass. Event-delegated via closest(), so it covers
// dynamically-added nodes; `[data-cursor="glass"]` opts extra targets in and
// `[data-cursor="none"]` opts any subtree out.
const INTERACTIVE =
  'a, button, [role="button"], input, textarea, select, label, summary, [data-cursor="glass"]';

/** The interactive element under `node`, or null (also null inside an opt-out). */
function interactiveAncestor(node: Element | null): Element | null {
  if (!node) return null;
  const el = node.closest(INTERACTIVE);
  if (!el || el.closest('[data-cursor="none"]')) return null;
  return el;
}

/**
 * The topmost interactive element under the point — found by hit-testing the
 * WHOLE layer stack, not `event.target`. This page stacks full-viewport WebGL
 * canvases with `pointer-events:auto` (the intro/hero R3F canvas needs them for
 * rock-hover) OVER the DOM, so `pointerover`'s target is the canvas and the
 * anchors beneath it are never seen. `elementsFromPoint` returns every layer at
 * the point (the cursor's own pointer-events:none disc included, but it isn't
 * interactive so it's skipped), so we can reach the CTA under the canvas.
 */
function interactiveAt(x: number, y: number): Element | null {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    const hit = interactiveAncestor(el);
    if (hit) return hit;
  }
  return null;
}

export default function CursorVisual() {
  const outerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);

  // Glass morph is enabled only on a capable tier with motion allowed; low tier
  // and reduced-motion collapse to the plain white disc. Seeded synchronously
  // (this component is client-only) so there's no mount flip, then kept live for
  // a mid-session watchdog step-down or an OS motion-preference change.
  const [glassEnabled, setGlassEnabled] = useState(
    () =>
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      getTierName() !== "low",
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => setGlassEnabled(!mq.matches && getTierName() !== "low");
    mq.addEventListener("change", decide);

    // Latch the glass decision to the INITIAL gpu-tier pick, then freeze. The
    // frame-watchdog is armed only AFTER the intro docks (quality-controller.tsx)
    // and steps even a *capable* machine down to `low` during heavy moments; a
    // reactive gate would then unmount the cursor glass for the rest of the
    // session (it shows for the first second, then vanishes — the exact bug
    // reported). The initial pick always resolves before the watchdog can fire,
    // so we capture it once and ignore later step-downs — mirroring
    // GlassSurface's latch (lib/perf/tiers.ts: GPU protection is the initial
    // pick, not the watchdog). Genuinely weak machines start at `low` → white
    // disc from the outset. The hover-only 44px lens is negligible cost, so
    // keeping it through a demotion is safe. Motion preference stays live.
    let latched = false;
    let unsub = () => {};
    const latch = () => {
      if (latched) return;
      latched = true;
      decide();
      unsub();
      clearTimeout(settle);
    };
    // First store emit = initQuality's pick (the reliable case). The timer is a
    // failsafe for the race where that emit lands before this effect subscribes;
    // 1500ms is comfortably after the pick (~300–500ms) yet before the earliest
    // possible watchdog step (intro dock + warmup + sustain, several seconds).
    unsub = subscribeQuality(latch);
    const settle = window.setTimeout(latch, 1500);

    return () => {
      mq.removeEventListener("change", decide);
      unsub();
      clearTimeout(settle);
    };
  }, []);

  useEffect(() => {
    const outer = outerRef.current;
    const dot = dotRef.current;
    if (!outer || !dot) return;

    // Hide the native cursor only while this is live (scoped to the attribute in
    // globals.css) — touch / no-JS / SSR keep their native cursor.
    document.documentElement.dataset.customCursor = "on";

    const setX = gsap.quickSetter(outer, "x", "px");
    const setY = gsap.quickSetter(outer, "y", "px");
    gsap.set(outer, { autoAlpha: 0 });

    // Fade in on the first move (we don't know the pointer position until then,
    // so parking it at 0,0 would flash); hide when the pointer leaves the window
    // / the tab blurs so it can't get stuck in a corner.
    let shown = false;
    let hovered: Element | null = null;
    let morph: gsap.core.Timeline | null = null;

    const show = () => {
      if (shown) return;
      shown = true;
      gsap.to(outer, { autoAlpha: 1, duration: 0.2, ease: "power2.out" });
    };
    const hide = () => {
      shown = false;
      hovered = null;
      morph?.reverse();
      gsap.to(outer, { autoAlpha: 0, duration: 0.15, ease: "power2.in" });
    };

    // Glass morph — only when the tier/motion pref allow it and the layer is
    // actually mounted. Built before onMove so the hover hit-test can drive it.
    const glass = glassRef.current;
    if (glassEnabled && glass) {
      gsap.set(glass, { autoAlpha: 0, scale: 0.5, transformOrigin: "50% 50%" });
      gsap.set(dot, { scale: 1, autoAlpha: 1, transformOrigin: "50% 50%" });
      morph = gsap
        .timeline({ paused: true, defaults: { duration: 0.28, ease: "power3.out" } })
        .to(dot, { scale: 1.7, autoAlpha: 0 }, 0)
        .to(glass, { scale: 1, autoAlpha: 1 }, 0);
    }

    const onMove = (e: PointerEvent) => {
      setX(e.clientX);
      setY(e.clientY);
      show();
      // Hover is resolved by hit-testing the layer stack (see interactiveAt) —
      // a pointer-events:auto canvas sits over the DOM, so event.target can't be
      // trusted. Only when glass is enabled; the follow above is always live.
      if (!morph) return;
      const target = interactiveAt(e.clientX, e.clientY);
      if (target && target !== hovered) {
        hovered = target;
        morph.play();
      } else if (!target && hovered) {
        hovered = null;
        morph.reverse();
      }
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
      morph?.kill();
      gsap.killTweensOf(outer);
      gsap.killTweensOf(dot);
      if (glass) gsap.killTweensOf(glass);
      delete document.documentElement.dataset.customCursor;
    };
  }, [glassEnabled]);

  return (
    <div
      ref={outerRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999]"
      style={{ willChange: "transform", visibility: "hidden" }}
    >
      {/* Rest state — solid white disc, centred on the point via negative margins
          (no transform, so GSAP's scale/opacity never fights the centering). */}
      <span
        ref={dotRef}
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

      {/* Hover state — the liquid-glass lens. Mounted only when the tier/motion
          pref allow glass; <GlassSurface/> internally serves clear glass (no
          displacement) on Firefox/Safari and on its own low tier. Displacement
          magnitude is scaled down from the why-stay pill's -180 to suit a 44px
          lens (a large scale shreds a tiny rim instead of bulging it). */}
      {glassEnabled && (
        <div
          ref={glassRef}
          aria-hidden
          className="absolute left-0 top-0"
          style={{
            width: LENS,
            height: LENS,
            marginLeft: -LENS / 2,
            marginTop: -LENS / 2,
          }}
        >
          <GlassSurface
            width={LENS}
            height={LENS}
            borderRadius={LENS / 2}
            borderWidth={0.07}
            brightness={50}
            opacity={0.9}
            blur={5}
            displace={0}
            backgroundOpacity={0}
            saturation={1}
            distortionScale={-55}
            redOffset={0}
            greenOffset={6}
            blueOffset={12}
            chromatic
          />
        </div>
      )}
    </div>
  );
}

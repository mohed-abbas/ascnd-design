"use client";

/**
 * CloudCanvasView — the reusable, config-driven mount for the image globe. Both
 * the lab sandbox (live controls) and, later, the portfolio `cloudCanvas` variant
 * (frozen preset) render this same component; only the props differ.
 *
 * House-rules compliance (heavy-effect contract, CLAUDE.md):
 *  - Rides the shared gsap.ticker (LenisProvider's "one loop") — no private rAF.
 *  - Paint rate goes through heavyEffectFpsCap() (contract #3): the ticker
 *    accumulates deltaTime and only ticks the engine once the cap's frame budget
 *    has elapsed (cap 0 = uncapped on a 60 Hz high-tier panel → every frame).
 *    Re-read each frame so a mid-session tier step-down applies live.
 *  - Idles to zero off-screen: an IntersectionObserver with a 0px rootMargin
 *    gates the tick, and `inView` starts FALSE — nothing repaints until the
 *    canvas actually intersects the viewport (a 200px margin used to wake the
 *    loop through the entire preceding testimonials scroll).
 *  - Lazy init: the 28-image fetch + main-thread decode + downscale does NOT run
 *    at mount (it used to land during the intro/hero moment). A one-shot
 *    near-view observer (~1000px ahead — the portfolio section sits ~8000px+
 *    down the page, so it never fires at the top) kicks off engine.init() early
 *    enough that the images are ready before the section scrolls in.
 *  - Lite mode: engine.init() ends with a self-benchmark of two real frames;
 *    a slow (CPU-rasterized) canvas2d — Firefox/Linux, blocklisted GPUs —
 *    locks the engine into a cheaper recipe (engine.isLite; see the engine
 *    header) and this view caps its tick at 30fps instead of the tier cap.
 *    Decided at init, which the near-view observer fires ~1000px before the
 *    canvas is visible, and never re-evaluated mid-view — the mounted-feature
 *    tier lock (CLAUDE.md), applied at our actual decision point.
 *  - Client-only + SSR-safe: nothing here runs on the server (the lab page loads it
 *    via next/dynamic ssr:false); first paint is an empty transparent canvas.
 *
 * Loaded via next/dynamic({ ssr:false }) by its consumers.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { heavyEffectFpsCap, scrollRepaintFpsCap } from "@/lib/perf/quality-store";
import { CloudCanvasEngine } from "./cloud-canvas-engine";
import {
  cloudProjects,
  type CloudFilter,
  type CloudProject,
} from "./cloud-canvas-data";
import type { CloudCanvasConfig } from "./cloud-canvas-config";

interface CloudCanvasViewProps {
  config: CloudCanvasConfig;
  images?: CloudProject[];
  /** Type filter (the section tabs) — the formation re-forms on change. */
  filter?: CloudFilter;
  /** Enable pointer drag + click focus. */
  interactive?: boolean;
  /**
   * Enable wheel-to-zoom. OFF in the pinned portfolio section (it would call
   * preventDefault on wheel and trap page scroll); ON in the lab sandbox.
   */
  wheelZoom?: boolean;
  /**
   * Selector for an element whose TOP must reach the top of the viewport before
   * the near-view init observer is armed at all — a floor on how early the image
   * load may start, so it can't land on top of heavier scroll work above it.
   * Omit (the lab sandbox) to arm at mount; see the gate below for why it
   * exists. Must be an UNPINNED element — see the note there.
   */
  initFrom?: string;
  className?: string;
}

export default function CloudCanvasView({
  config,
  images = cloudProjects,
  filter = "all",
  interactive = true,
  wheelZoom = true,
  initFrom,
  className,
}: CloudCanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CloudCanvasEngine | null>(null);

  // Mount the engine once. `images` is treated as stable per mount; a different set
  // should key the component to remount (same pattern as the carousel variants).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new CloudCanvasEngine(canvas, config, images);
    engineRef.current = engine;

    let disposed = false;
    // Starts FALSE — the loop stays cold until the first IO callback confirms
    // the canvas is actually on-screen (not merely mounted).
    let inView = false;
    let tickerFn: ((time: number, deltaTime: number) => void) | null = null;

    // 0px margin: wake the repaint loop only when the canvas itself intersects.
    // (A 200px margin on this full-bleed min-h-dvh canvas kept the loop hot
    // through the whole testimonials scroll above it.)
    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? false;
      },
      { rootMargin: "0px" },
    );
    io.observe(canvas);

    // Is the primary input a finger? Decides the touch-action policy, the
    // repaint cap and the resize debounce below. Locked at mount like every
    // other quality decision here.
    const coarse =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;

    // Resize → reallocate the backing store. On a phone the canvas is `h-dvh`,
    // so the URL bar collapsing during a fling changes its height and would
    // reallocate 740,610 device px MID-SCROLL. Width changes (rotation) still
    // apply immediately; height-only changes are debounced past the fling so a
    // URL-bar animation costs one reallocation instead of one per frame. The
    // canvas is briefly stretched during the debounce, which on a soft
    // out-of-focus cloud of tiles is invisible.
    let lastW = canvas.clientWidth;
    let resizeTid: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth;
      if (!coarse || w !== lastW) {
        lastW = w;
        clearTimeout(resizeTid);
        engine.resize();
        return;
      }
      clearTimeout(resizeTid);
      resizeTid = setTimeout(() => engine.resize(), 250);
    });
    ro.observe(canvas);

    // Pointer input (Pointer Events cover mouse + single-finger touch).
    const localPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      if (!interactive) return;
      // Capture only for mouse/pen. Pointer capture exists so a drag that
      // leaves the canvas keeps rotating, which is meaningless for a finger —
      // and grabbing a touch pointer the instant it lands can stop the browser
      // handing the gesture to the scroller. `pointercancel` (mapped to onUp)
      // is what ends a touch drag once the page takes over the pan.
      if (e.pointerType !== "touch") canvas.setPointerCapture(e.pointerId);
      const p = localPoint(e);
      engine.pointerDown(p.x, p.y);
    };
    const onMove = (e: PointerEvent) => {
      if (!interactive) return;
      const p = localPoint(e);
      engine.pointerMove(p.x, p.y);
    };
    const onUp = (e: PointerEvent) => {
      if (!interactive) return;
      const p = localPoint(e);
      engine.pointerUp(p.x, p.y);
    };
    const onLeave = () => {
      if (!interactive) return;
      engine.pointerLeave();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      engine.wheel(e.deltaY);
    };

    if (interactive) {
      canvas.style.cursor = "grab";
      // ⚠️ `pan-y`, never `none`. This canvas is full-bleed inside a 100dvh
      // band, so on a phone it IS the viewport — 844 of the section's 1012px,
      // full width. With `touch-action: none` the browser performs no default
      // behaviour for any touch landing on it, and since scrolling here is
      // native (Lenis is not mounted on touch, and did not drive touch scroll
      // even when it was), that made ~83% of the section a hard scroll-dead
      // zone exactly one viewport tall: a visitor who stopped mid-section had
      // no on-screen scrollable area left except the ~36px filter pill row.
      // They were stuck, and no amount of swiping got them out.
      //
      // `pan-y` gives the vertical axis back to the scroller and keeps the
      // horizontal for the globe, so a swipe scrolls the page and a sideways
      // drag still spins it. Pitch-by-drag is what this trades away on touch —
      // the correct trade, since the page has to win. Harmless on desktop:
      // touch-action does not affect mouse input at all, and on a touchscreen
      // laptop it is the same right answer.
      canvas.style.touchAction = "pan-y";
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("lostpointercapture", onUp);
      canvas.addEventListener("pointerleave", onLeave);
    }
    if (interactive && wheelZoom) {
      canvas.addEventListener("wheel", onWheel, { passive: false });
    }

    // Deferred init flow — identical to what used to run at mount, just held
    // until the near-view observer below fires. The `disposed` race handling is
    // preserved: unmount-before-resolve is caught inside .then (dispose again),
    // unmount-after-resolve by the cleanup below.
    const startInit = () => {
      engine
        .init()
        .then(() => {
          if (disposed) {
            engine.dispose();
            return;
          }
          engine.resize();
          // gsap.ticker: deltaTime is milliseconds since the last tick. Paints
          // are capped via heavyEffectFpsCap() (contract #3): accumulate the
          // delta and skip frames until the cap's budget (1000/cap ms) has
          // elapsed, then tick with the accumulated step. Cap 0 = uncapped →
          // this degenerates to ticking every frame with the raw delta. The
          // engine clamps dt at 0.034s, so a capped 16.7ms step is well within
          // range. Read every frame so a mid-session step-down applies live.
          // LITE: a lite engine (CPU-rasterized canvas2d, locked at init) caps
          // at 30fps regardless of tier — even the lite recipe pays software
          // raster per pixel, and 30fps halves whatever that still costs while
          // the slow auto-spin reads perfectly fine at 30. isLite is settled
          // before this ticker ever runs (the benchmark is part of init).
          let accMs = 0;
          tickerFn = (_time, deltaTime) => {
            if (!inView) return;
            accMs += deltaTime;
            // Idle auto-drift is self-animating → the 60 cap is invisible.
            // While the user steers (drag or live fling momentum) the CURSOR
            // is the reference frame, so ride the display on the high tier
            // (scrollRepaintFpsCap: 0 = uncapped, 60 on stepped-down tiers) —
            // same input-linked rule as the scroll rigs. Lite engines stay at
            // 30 regardless: software raster is too slow either way.
            // COARSE POINTER: a hard 30. The tier system cannot be relied on
            // to protect phones here — it has no viewport input at all, and
            // both common phones resolve to tier `high`: iOS reports "Apple
            // GPU" (no /apple m\d/ match), exposes no navigator.deviceMemory
            // and 6 cores, so it falls through to `unknown` → high; a flagship
            // Adreno matches `strong` → high. On high, heavyEffectFpsCap() is
            // 0 (uncapped) below 70Hz and scrollRepaintFpsCap() is 0 always.
            // So the busiest recipe on the page — 48 drawImage, 25 fillRect, 24
            // clips and 2 shadow-blurred fillText per frame, with no dirty
            // check because the 0.2 autospin never reaches rest — was running
            // uncapped for the ~1688px of scroll this canvas intersects.
            // The drift is one revolution per 66s; at 30fps that is visually
            // identical and costs half.
            const cap = coarse
              ? 30
              : engine.isLite
                ? 30
                : engine.interacting
                  ? scrollRepaintFpsCap()
                  : heavyEffectFpsCap();
            // 1ms tolerance: on a 120Hz ticker two ~8.33ms deltas sum to
            // ~16.66ms — JUST under the 16.67ms budget — so without it every
            // second paint slipped a tick and the cadence degraded to a
            // 16.7/25ms mix: a measured ~44fps presented with visible beat
            // (the "portfolio stuck at 45fps" report, 2026-07-18). With the
            // tolerance the cap lands a stable every-2nd-tick 60.
            if (cap > 0 && accMs < 1000 / cap - 1) return;
            engine.tick(accMs / 1000);
            accMs = 0;
          };
          gsap.ticker.add(tickerFn);
        })
        .catch((err) => console.error("CloudCanvasEngine init failed", err));
    };

    // Lazy init: the 28-image fetch + decode + downscale is deliberately NOT
    // kicked off at mount — at page load that work landed in the middle of the
    // intro/hero moment. This one-shot observer starts it ~1000px before the
    // section scrolls into view: far enough that a normal scroll finishes the
    // load before the canvas is visible, close enough that it doesn't fire
    // while the user is still up the page.
    let initIo: IntersectionObserver | null = null;
    const armInit = () => {
      if (disposed || initIo) return;
      initIo = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          initIo?.disconnect();
          startInit();
        },
        { rootMargin: "1000px" },
      );
      initIo.observe(canvas);
    };

    // ...but "1000px ahead" is measured from the canvas, so how far up the page
    // it reaches depends entirely on where the consumer puts this section — an
    // assumption that silently broke when the portfolio section moved up the
    // homepage (it used to sit ~8000px down, past everything). At its position
    // before Comparison the observer would arm ~4860px in, landing the whole
    // 1.44MB fetch + 28 decodes INSIDE the pinned WhyStay scrub, the heaviest
    // scroll moment on the page. `initFrom` puts a floor under that: no arming
    // until its element's top reaches the viewport top. The near-view margin
    // then still buys its full lead time from there.
    //
    // Prefer an UNPINNED element here. Naming the pinned section itself (the
    // obvious reading of "wait for the pin to finish") does measurably work, but
    // it resolves "top top" against an element ScrollTrigger re-measures with
    // its pin reverted, while this view is loaded through next/dynamic — so its
    // trigger is created well after the pin's own, out of page order, and
    // nothing in this codebase sets refreshPriority. That's the arrangement the
    // GSAP docs specifically warn about. Naming the first unpinned section AFTER
    // the pin sidesteps it entirely: plain document flow, so "top top" is
    // unambiguous whenever it's created, and reaching it already implies the pin
    // released.
    //
    // ScrollTrigger rather than a second IntersectionObserver because IO
    // callbacks are throttled during continuous scroll (the same starvation
    // testimonial-rocks documents). No gate (the lab sandbox) → arm immediately,
    // exactly as before; a selector that matches nothing also arms immediately,
    // since the gate is an optimisation and never a prerequisite for the globe
    // appearing.
    let gate: ScrollTrigger | null = null;
    const gateEl = initFrom
      ? document.querySelector<HTMLElement>(initFrom)
      : null;
    if (gateEl) {
      gsap.registerPlugin(ScrollTrigger);
      gate = ScrollTrigger.create({
        trigger: gateEl,
        start: "top top", // gate element has reached the top of the viewport
        end: "max",
        onEnter: armInit,
      });
      if (gate.isActive) armInit(); // seed: loaded/restored already past it
    } else {
      armInit();
    }

    return () => {
      disposed = true;
      if (tickerFn) gsap.ticker.remove(tickerFn);
      io.disconnect();
      initIo?.disconnect();
      gate?.kill();
      ro.disconnect();
      clearTimeout(resizeTid);
      if (interactive) {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        canvas.removeEventListener("lostpointercapture", onUp);
        canvas.removeEventListener("pointerleave", onLeave);
      }
      canvas.removeEventListener("wheel", onWheel);
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, interactive, wheelZoom, initFrom]);

  // Live config updates — read by the engine without a remount.
  useEffect(() => {
    engineRef.current?.setConfig(config);
  }, [config]);

  // Live filter updates — the engine re-forms; safe pre-init (it stores the
  // filter and the first card build applies it).
  useEffect(() => {
    engineRef.current?.setFilter(filter);
  }, [filter]);

  return <canvas ref={canvasRef} className={className} />;
}

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
  className?: string;
}

export default function CloudCanvasView({
  config,
  images = cloudProjects,
  filter = "all",
  interactive = true,
  wheelZoom = true,
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

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(canvas);

    // Pointer input (Pointer Events cover mouse + single-finger touch).
    const localPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      if (!interactive) return;
      canvas.setPointerCapture(e.pointerId);
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
      canvas.style.touchAction = "none";
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
            const cap = engine.isLite
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
    // load before the canvas is visible, close enough that it never fires while
    // the user is at the top of the page (portfolio sits ~8000px+ down).
    const initIo = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        initIo.disconnect();
        startInit();
      },
      { rootMargin: "1000px" },
    );
    initIo.observe(canvas);

    return () => {
      disposed = true;
      if (tickerFn) gsap.ticker.remove(tickerFn);
      io.disconnect();
      initIo.disconnect();
      ro.disconnect();
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
  }, [images, interactive, wheelZoom]);

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

"use client";

/**
 * CloudCanvasView — the reusable, config-driven mount for the image globe. Both
 * the lab sandbox (live controls) and, later, the portfolio `cloudCanvas` variant
 * (frozen preset) render this same component; only the props differ.
 *
 * House-rules compliance (heavy-effect contract, CLAUDE.md):
 *  - Rides the shared gsap.ticker (LenisProvider's "one loop") — no private rAF.
 *  - Pauses entirely when the canvas is off-screen (IntersectionObserver), so it
 *    idles to zero the moment the section leaves the viewport.
 *  - Client-only + SSR-safe: nothing here runs on the server (the lab page loads it
 *    via next/dynamic ssr:false); first paint is an empty transparent canvas.
 *
 * Loaded via next/dynamic({ ssr:false }) by its consumers.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CloudCanvasEngine } from "./cloud-canvas-engine";
import { cloudImages, type CloudImage } from "./cloud-canvas-data";
import type { CloudCanvasConfig } from "./cloud-canvas-config";

interface CloudCanvasViewProps {
  config: CloudCanvasConfig;
  images?: CloudImage[];
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
  images = cloudImages,
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
    let inView = true;
    let tickerFn: ((time: number, deltaTime: number) => void) | null = null;

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? false;
      },
      { rootMargin: "200px" },
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

    engine
      .init()
      .then(() => {
        if (disposed) {
          engine.dispose();
          return;
        }
        engine.resize();
        // gsap.ticker: deltaTime is milliseconds since the last tick.
        tickerFn = (_time, deltaTime) => {
          if (!inView) return;
          engine.tick(deltaTime / 1000);
        };
        gsap.ticker.add(tickerFn);
      })
      .catch((err) => console.error("CloudCanvasEngine init failed", err));

    return () => {
      disposed = true;
      if (tickerFn) gsap.ticker.remove(tickerFn);
      io.disconnect();
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

  return <canvas ref={canvasRef} className={className} />;
}

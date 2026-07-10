"use client";

/**
 * PortfolioCanvas — mounts the imperative depth-gallery engine into a section-
 * scoped <canvas> and reconciles it with the page:
 *
 *   • Render loop rides the shared `gsap.ticker` (no private rAF) — the site's
 *     "one loop, no competing schedulers" mandate. `time` (seconds) → ms for the
 *     engine's shader/timer clock.
 *   • Scroll comes from a pinned + scrubbed ScrollTrigger on the section: page
 *     scroll drives `self.progress` → `engine.setProgress()`, flying the camera
 *     through the depth planes, then releasing to the next section.
 *   • A ResizeObserver keeps the drawing buffer matched to the canvas; an
 *     IntersectionObserver skips rendering while the section is off-screen (basic
 *     correctness — NOT quality-tier gating, which is a later pass).
 *
 * Loaded via `next/dynamic({ ssr: false })` from portfolio-scene.tsx.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PortfolioEngine } from "./engine/portfolio-engine";

gsap.registerPlugin(ScrollTrigger);

// How many viewport-heights of scroll the pin lasts (traversal pace). Tuned in
// the fidelity-polish pass against the reference demo.
const PIN_SCREENS = 5;
const SCRUB = 0.5;

export default function PortfolioCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const engine = new PortfolioEngine(canvas, wrapper);
    const section = (wrapper.closest("[data-portfolio]") as HTMLElement | null) ?? wrapper;

    let disposed = false;
    let inView = false;
    let tickerFn: ((time: number) => void) | null = null;
    let st: ScrollTrigger | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let intersectionObserver: IntersectionObserver | null = null;

    engine
      .init()
      .then(() => {
        if (disposed) {
          engine.dispose();
          return;
        }

        // Render on the shared ticker; skip frames while off-screen.
        tickerFn = (time: number) => {
          if (!inView) return;
          engine.tick(time * 1000);
        };
        gsap.ticker.add(tickerFn);

        // Pin the section and scrub camera depth from scroll progress.
        st = ScrollTrigger.create({
          trigger: section,
          start: "top top",
          end: () => "+=" + window.innerHeight * PIN_SCREENS,
          pin: true,
          scrub: SCRUB,
          onUpdate: (self) => engine.setProgress(self.progress),
          onRefresh: (self) => engine.setProgress(self.progress),
        });

        intersectionObserver = new IntersectionObserver(
          (entries) => {
            inView = entries[0]?.isIntersecting ?? false;
          },
          { rootMargin: "200px" },
        );
        intersectionObserver.observe(section);

        resizeObserver = new ResizeObserver(() => {
          engine.resize();
          ScrollTrigger.refresh();
        });
        resizeObserver.observe(wrapper);

        engine.resize();
        ScrollTrigger.refresh();
      })
      .catch((error) => {
        console.error("PortfolioEngine init failed", error);
      });

    return () => {
      disposed = true;
      if (tickerFn) gsap.ticker.remove(tickerFn);
      st?.kill();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      engine.dispose();
    };
  }, []);

  return (
    <div ref={wrapperRef} className="absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

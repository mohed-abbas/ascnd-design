"use client";

/**
 * CarouselCanvas — mounts the mode-parameterized CarouselEngine (V3) into a
 * section-scoped <canvas> and reconciles it with the page, exactly like the depth
 * gallery's canvas:
 *
 *   • Render loop rides the shared gsap.ticker (no private rAF); skipped while the
 *     section is off-screen (IntersectionObserver).
 *   • A pinned + scrubbed ScrollTrigger feeds `self.progress` → `engine.setProgress`,
 *     advancing the carousel "head" through the projects.
 *   • The engine calls back on active-project change; a React overlay renders the
 *     project card (reusing the .plane-label styles) at bottom-centre.
 *
 * Loaded via next/dynamic({ ssr:false }) from carousel-scene.tsx. `mode` is fixed
 * per mount (the parent keys each variant), so the effect needs no mode dep.
 */
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CarouselEngine, type CarouselMode } from "./carousel/carousel-engine";
import { galleryPlaneData } from "./portfolio-data";

gsap.registerPlugin(ScrollTrigger);

// Viewport-heights of scroll the pin lasts (traversal pace across the projects).
const PIN_SCREENS = 5;
const SCRUB = 0.5;

export default function CarouselCanvas({ mode }: { mode: CarouselMode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const engine = new CarouselEngine(canvas, wrapper, mode, setActiveIndex);
    const section = (wrapper.closest("[data-portfolio]") as HTMLElement | null) ?? wrapper;

    let disposed = false;
    let inView = false;
    let tickerFn: ((time: number) => void) | null = null;
    let resizeRaf = 0;

    // Pin synchronously on mount so the pin-spacer is part of the initial layout
    // (see the depth canvas for why late injection jams scroll).
    const st = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: () => "+=" + window.innerHeight * PIN_SCREENS,
      pin: true,
      scrub: SCRUB,
      invalidateOnRefresh: true,
      onUpdate: (self) => engine.setProgress(self.progress),
      onRefresh: (self) => engine.setProgress(self.progress),
    });

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? false;
      },
      { rootMargin: "200px" },
    );
    intersectionObserver.observe(section);

    const onResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        engine.resize();
        ScrollTrigger.refresh();
      });
    };
    window.addEventListener("resize", onResize);

    // Refresh once the pin-spacer exists (ScrollTrigger + Lenis re-measure the
    // taller page), then again for late-settling layout.
    ScrollTrigger.refresh();
    const settleTimer = window.setTimeout(() => ScrollTrigger.refresh(), 500);

    engine
      .init()
      .then(() => {
        if (disposed) {
          engine.dispose();
          return;
        }
        tickerFn = () => {
          if (!inView) return;
          engine.tick();
        };
        gsap.ticker.add(tickerFn);
        engine.resize();
        engine.setProgress(st.progress);
      })
      .catch((error) => {
        console.error("CarouselEngine init failed", error);
      });

    return () => {
      disposed = true;
      if (tickerFn) gsap.ticker.remove(tickerFn);
      window.removeEventListener("resize", onResize);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      window.clearTimeout(settleTimer);
      st.kill();
      intersectionObserver.disconnect();
      engine.dispose();
    };
  }, [mode]);

  const project = galleryPlaneData[activeIndex] ?? galleryPlaneData[0];

  return (
    <div ref={wrapperRef} className="absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="plane-label-overlay plane-label-overlay--carousel" style={{ color: "#fff" }}>
        <article className="plane-label" key={activeIndex}>
          <h3 className="plane-label__name">{project.label.name.toLowerCase()}</h3>
          <ul className="plane-label__tags">
            {project.label.tags.map((tag) => (
              <li key={tag} className="plane-label__tag">
                {tag}
              </li>
            ))}
          </ul>
          <p className="plane-label__desc">{project.label.description}</p>
        </article>
      </div>
    </div>
  );
}

"use client";

/**
 * Cloudline — portfolio V2. A pinned, horizontally-scrubbed drift where the
 * project stills pass across the sky like the volumetric clouds behind them:
 * near cards are larger, sharper, and lead the track; far cards are smaller,
 * softer-edged, and lag (parallax depth). Each still wears a feathered mask so
 * its edges dissolve into the sky — a window opening in the cloudbank — with a
 * house-glass caption beneath.
 *
 * Pure DOM + GSAP (no WebGL): one ScrollTrigger pins the section and scrubs a
 * single progress value → the track's X plus each card's per-lane parallax. It's
 * fully scroll-driven, so nothing repaints when the pointer is still (idle to
 * zero for free). Transparent over the global sky, like every other section.
 *
 * Shares the same 5 projects as the depth gallery (portfolio-data.ts).
 */
import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { galleryPlaneData } from "./portfolio-data";

gsap.registerPlugin(ScrollTrigger);

const SCRUB = 0.6;

// Depth lanes, mapped by index onto the shared projects. `y` is a static
// altitude offset (vh, viewport-relative); `par` is the extra horizontal drift
// in px across the full scroll — negative leads the track (near/faster),
// positive lags it (far/slower) — which reads as cloud parallax.
const LANES = [
  { depth: "near", y: -6, par: -170 },
  { depth: "far", y: 12, par: 190 },
  { depth: "mid", y: -11, par: -50 },
  { depth: "near", y: 7, par: -170 },
  { depth: "mid", y: -2, par: 70 },
] as const;

export default function CloudlineScene() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const track = trackRef.current;
    if (!wrapper || !track) return;

    const section = (wrapper.closest("[data-portfolio]") as HTMLElement | null) ?? wrapper;
    const cards = Array.from(track.children) as HTMLElement[];

    let maxTravel = 0;
    const measure = () => {
      maxTravel = Math.max(0, track.scrollWidth - window.innerWidth);
    };
    measure();

    // Scrub → track X (leftward) + per-card parallax + static altitude. y is
    // recomputed each apply so it tracks viewport-height changes on resize.
    const apply = (progress: number) => {
      const vh = window.innerHeight / 100;
      gsap.set(track, { x: -maxTravel * progress });
      cards.forEach((card, index) => {
        const lane = LANES[index % LANES.length];
        gsap.set(card, { x: lane.par * progress, y: lane.y * vh });
      });
    };

    const st = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      // Map the pin length to the horizontal distance so the drift paces 1:1
      // with scroll, plus a little tail so the last card fully clears.
      end: () => {
        measure();
        return "+=" + (maxTravel + window.innerHeight * 0.5);
      },
      pin: true,
      scrub: SCRUB,
      invalidateOnRefresh: true,
      onRefresh: (self) => {
        measure();
        apply(self.progress);
      },
      onUpdate: (self) => apply(self.progress),
    });

    let resizeRaf = 0;
    const onResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        measure();
        ScrollTrigger.refresh();
      });
    };
    window.addEventListener("resize", onResize);

    // Refresh once now that the pin-spacer exists (so ScrollTrigger — and, via
    // LenisProvider's refresh→resize sync — Lenis re-read the taller page), then
    // again after late layout settles.
    ScrollTrigger.refresh();
    const settle = window.setTimeout(() => ScrollTrigger.refresh(), 400);

    return () => {
      window.removeEventListener("resize", onResize);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      window.clearTimeout(settle);
      st.kill();
    };
  }, []);

  return (
    <div ref={wrapperRef} className="absolute inset-0 overflow-hidden">
      <div
        ref={trackRef}
        className="cloudline-track absolute inset-y-0 left-0 flex items-center"
      >
        {galleryPlaneData.map((project, index) => {
          const lane = LANES[index % LANES.length];
          return (
            <article
              key={project.textureSrc}
              className="cloudline-card"
              data-depth={lane.depth}
            >
              <div className="cloudline-frame">
                <Image
                  src={project.textureSrc}
                  alt={project.label.name}
                  fill
                  sizes="(max-width: 768px) 60vw, 42vw"
                  className="object-cover"
                />
              </div>
              <div className="cloudline-caption">
                <span className="cloudline-caption__name">
                  {project.label.name.toLowerCase()}
                </span>
                <span className="cloudline-caption__dot" aria-hidden />
                <span className="cloudline-caption__tags">
                  {project.label.tags.join(" · ")}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

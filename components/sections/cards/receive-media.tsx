"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { SHOT_TILES } from "./cards-data";

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// Shots dissolve just before the "receive" title so the label reads over clean
// glass. The window also clips the tiles as they drift in/out from off-frame.
const FADE = "linear-gradient(to bottom, black 78%, transparent 96%)";

// Same gold→green aura as the subscribe end-button (get_design_context flattens
// it to a flat #ffe8b7). Symmetric so the shimmer's position loop is seamless.
const AURA = "linear-gradient(90deg, #ffe8b7, #bbfc73, #ffe8b7)";

const DELIVERED = "delivered";

// Each tile flies in from the direction it sits relative to the 594×510 plane's
// centre (top-left tile from the top-left, etc.), so the collage assembles from
// its corners.
const PLANE_CX = 594 / 2;
const PLANE_CY = 510 / 2;
const offsetX = (i: number) => {
  const t = SHOT_TILES[i];
  return (t.x + t.w / 2 < PLANE_CX ? -1 : 1) * 150;
};
const offsetY = (i: number) => {
  const t = SHOT_TILES[i];
  return (t.y + t.h / 2 < PLANE_CY ? -1 : 1) * 140;
};

/**
 * Card1 "receive" media (Figma start 220:212 → delivered state 124:254).
 *
 * A looping "work → delivered" beat: the design-shot collage sits assembled,
 * then blurs as a white "✓ delivered" pill pops in (check springs, label rolls
 * up, gold→green aura shimmers); after a hold the tiles disperse to their
 * corners and reassemble, and it repeats.
 *
 * The tiles ride a 594×510 plane larger than (and offset within) the clipping
 * window, so only the design's crop shows and the drift happens off-frame. The
 * pill lives *outside* the clip so the grid blur never touches it. GSAP only
 * animates transforms/opacity; the wrappers own their CSS positioning. Paused
 * until on-screen, and bails under prefers-reduced-motion (static grid remains).
 */
export default function ReceiveMedia() {
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const grid = gridRef.current;
    const dim = dimRef.current;
    const pill = pillRef.current;
    const check = checkRef.current;
    const label = labelRef.current;
    const shimmer = shimmerRef.current;
    if (!root || !grid || !dim || !pill || !check || !label || !shimmer) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const tiles = gsap.utils.toArray<HTMLElement>(grid.children);
    const chars = gsap.utils.toArray<HTMLElement>(label.querySelectorAll("[data-char]"));

    const ctx = gsap.context(() => {
      gsap.set(pill, { autoAlpha: 0, scale: 0.9 });
      gsap.set(check, { scale: 0 });
      gsap.set(chars, { yPercent: 110 });
      gsap.set(grid, { filter: "blur(0px)" });
      gsap.set(dim, { autoAlpha: 0 });
      // tiles start assembled (their markup home) — no initial offset, so SSR
      // and no-JS both show the finished collage.

      const sweep = gsap.to(
        [shimmer.querySelector("[data-aura-ring]"), shimmer.querySelector("[data-aura-glow]")],
        { backgroundPosition: "-200% 0", duration: 2.4, ease: "none", repeat: -1, paused: true }
      );

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5, paused: true });
      tl
        // assembled, sharp
        .to({}, { duration: 0.6 })
        // blur the grid + the "delivered" pill arrives
        .addLabel("deliver")
        .to(grid, { filter: "blur(7px)", duration: 0.5, ease: "power2.out" }, "deliver")
        .to(dim, { autoAlpha: 1, duration: 0.5 }, "deliver")
        .fromTo(
          pill,
          { autoAlpha: 0, scale: 0.9 },
          { autoAlpha: 1, scale: 1, duration: 0.34, ease: "back.out(2)" },
          "deliver+=0.15"
        )
        .fromTo(check, { scale: 0 }, { scale: 1, duration: 0.3, ease: "back.out(3)" }, "deliver+=0.28")
        .to(chars, { yPercent: 0, duration: 0.5, ease: "power3.out", stagger: 0.035 }, "deliver+=0.34")
        // hold, glowing
        .to({}, { duration: 1.4 })
        // pill leaves, grid clears
        .addLabel("exit")
        .to(pill, { autoAlpha: 0, scale: 0.95, duration: 0.32, ease: "power2.in" }, "exit")
        .to(grid, { filter: "blur(0px)", duration: 0.45 }, "exit")
        .to(dim, { autoAlpha: 0, duration: 0.45 }, "exit")
        .set(chars, { yPercent: 110 })
        .set(check, { scale: 0 })
        // tiles disperse to their corners, then reassemble
        .to(
          tiles,
          { x: offsetX, y: offsetY, autoAlpha: 0, duration: 0.55, ease: "power2.in", stagger: 0.07 },
          "exit+=0.2"
        )
        .to(
          tiles,
          { x: 0, y: 0, autoAlpha: 1, duration: 0.7, ease: "power3.out", stagger: 0.1 },
          ">-0.05"
        );

      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            tl.play();
            sweep.play();
          } else {
            tl.pause();
            sweep.pause();
          }
        },
        { threshold: 0.15 }
      );
      io.observe(root);

      return () => io.disconnect();
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="absolute inset-0">
      {/* Clipped grid window — the blur target. */}
      <div
        className="absolute left-[31px] top-[30px] h-[300px] w-[378px] overflow-hidden rounded-[12px]"
        style={{ WebkitMaskImage: FADE, maskImage: FADE }}
      >
        <div ref={gridRef} className="absolute left-[-75px] top-[-88px] h-[510px] w-[594px]">
          {SHOT_TILES.map((t) => (
            <div
              key={t.src}
              className="absolute overflow-hidden rounded-[12px]"
              style={{ left: t.x, top: t.y, width: t.w, height: t.h }}
            >
              <Image src={t.src} alt={t.alt} fill sizes="300px" className="object-cover" />
            </div>
          ))}
        </div>
        {/* Subtle dim while the pill is up. */}
        <div ref={dimRef} aria-hidden className="pointer-events-none absolute inset-0 bg-black/15" />
      </div>

      {/* "delivered" pill — outside the clip so the grid blur never hits it. */}
      <div className="absolute left-1/2 top-[150px] -translate-x-1/2">
        <div ref={pillRef} className="relative" style={{ opacity: 0 }}>
          <div ref={shimmerRef}>
            <div
              data-aura-glow
              aria-hidden
              className="pointer-events-none absolute -inset-[3px] -z-10 rounded-[34px]"
              style={{ background: AURA, backgroundSize: "200% 100%", filter: "blur(9px)", opacity: 0.6 }}
            />
            <div
              data-aura-ring
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10 rounded-[32px]"
              style={{
                padding: "3px",
                background: AURA,
                backgroundSize: "200% 100%",
                WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
              }}
            />
          </div>

          <div
            className="relative flex items-center gap-[8px] rounded-[32px] px-[20px] py-[7px]"
            style={{
              background: "linear-gradient(to bottom, #ffffff, #efefef 107.69%)",
              boxShadow: "inset 0px -2px 1px 0px #f2f2f2, inset 0px -2px 2px 0px rgba(0,0,0,0.5)",
            }}
          >
            <span ref={checkRef} className="inline-block shrink-0">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 12.5l4.2 4.2L19 7"
                  stroke="#263138"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span
              ref={labelRef}
              className="whitespace-nowrap font-product text-[21.333px] leading-[1.2] text-[#263138]"
            >
              {DELIVERED.split("").map((c, i) => (
                <span key={i} className="inline-block overflow-hidden align-bottom">
                  <span data-char className="inline-block">
                    {c}
                  </span>
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// The aura stroke sampled off the Figma end-state (get_design_context flattens
// it to a flat #ffe8b7): a warm gold → lime-green sweep. Symmetric so the
// shimmer's background-position loop is seamless (both ends are gold).
const AURA = "linear-gradient(90deg, #ffe8b7, #bbfc73, #ffe8b7)";

// Cursor travel: from its rest spot (left-292.5 / top-229.5, see the wrapper)
// up-and-left onto the button. Deltas are applied as a GSAP transform, so the
// wrapper keeps owning the base position.
const CURSOR_DX = -95;
const CURSOR_DY = -60;

/**
 * Card3 "subscribe" media (Figma start 220:163 → end 124:265).
 *
 * A self-running, looping micro-interaction that reads as onboarding:
 *   rest → the pointer drifts onto the "let's get started" glass pill →
 *   click-pop → the pill morphs into the white "creating your board" button
 *   with its gold→green aura shimmer → hold → reset → repeat.
 *
 * Two separate centered buttons (glass A, aura B) crossfade at the same spot
 * rather than reflowing one box between two different-width labels. GSAP only
 * ever animates scale/opacity on the buttons (their wrappers own the
 * -translate-x-1/2 centering, which GSAP would otherwise clobber) and x/y on
 * the cursor. The timeline is paused until the card scrolls into view and bails
 * entirely under prefers-reduced-motion (static start state remains).
 */
export default function SubscribeMedia() {
  const rootRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const startBtn = startRef.current;
    const endBtn = endRef.current;
    const cursor = cursorRef.current;
    const shimmer = shimmerRef.current;
    if (!root || !startBtn || !endBtn || !cursor || !shimmer) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const ctx = gsap.context(() => {
      gsap.set(endBtn, { autoAlpha: 0, scale: 0.9 });
      gsap.set(startBtn, { autoAlpha: 1, scale: 1 });
      gsap.set(cursor, { x: 0, y: 0, scale: 1, autoAlpha: 1 });

      // Continuous aura sweep — cheap, only visible while the end button is up.
      const sweep = gsap.to([shimmer.querySelector("[data-aura-ring]"), shimmer.querySelector("[data-aura-glow]")], {
        backgroundPosition: "-200% 0",
        duration: 2.4,
        ease: "none",
        repeat: -1,
        paused: true,
      });

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5, paused: true });
      tl
        // rest
        .to({}, { duration: 0.7 })
        // cursor drifts onto the button
        .to(cursor, { x: CURSOR_DX, y: CURSOR_DY, duration: 0.8, ease: "power2.inOut" })
        // click-pop (button + cursor tap together)
        .to(startBtn, { scale: 0.94, duration: 0.09, ease: "power2.in" })
        .to(cursor, { scale: 0.82, duration: 0.09, ease: "power2.in" }, "<")
        .to(startBtn, { scale: 1.03, duration: 0.15, ease: "back.out(3)" })
        .to(cursor, { scale: 1, duration: 0.15, ease: "back.out(3)" }, "<")
        .to(startBtn, { scale: 1, duration: 0.1 })
        // morph: glass out, aura in, cursor away
        .addLabel("morph")
        .to(startBtn, { autoAlpha: 0, duration: 0.22, ease: "power2.out" }, "morph")
        .to(cursor, { autoAlpha: 0, duration: 0.22, ease: "power2.out" }, "morph")
        .fromTo(
          endBtn,
          { autoAlpha: 0, scale: 0.9 },
          { autoAlpha: 1, scale: 1, duration: 0.34, ease: "back.out(2)" },
          "morph+=0.05"
        )
        // hold, glowing
        .to({}, { duration: 1.5 })
        // reset to the start state for the next loop
        .to(endBtn, { autoAlpha: 0, scale: 0.9, duration: 0.32, ease: "power2.in" })
        .set(cursor, { x: 0, y: 0, scale: 1 })
        .to([startBtn, cursor], { autoAlpha: 1, duration: 0.32, ease: "power2.out" });

      // Only run while the card is on screen.
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
      {/* Start state — glass "let's get started" pill (centering wrapper is CSS
          only; GSAP animates the inner ref). */}
      <div className="absolute left-1/2 top-[162.5px] -translate-x-1/2">
        <div
          ref={startRef}
          className="flex h-[40px] items-center justify-center rounded-[42.667px] border border-solid border-white/50 bg-white/10 px-[26.667px] backdrop-blur-[2.667px]"
        >
          <span className="whitespace-nowrap font-product text-[21.333px] leading-none text-white">
            let&rsquo;s get started
          </span>
        </div>
      </div>

      {/* End state — white "creating your board" button with the gold→green
          aura ring + glow. Hidden until the morph. */}
      <div className="absolute left-1/2 top-[163.5px] -translate-x-1/2">
        <div ref={endRef} className="relative" style={{ opacity: 0 }}>
          <div ref={shimmerRef}>
            {/* glow halo */}
            <div
              data-aura-glow
              aria-hidden
              className="pointer-events-none absolute -inset-[3px] -z-10 rounded-[34px]"
              style={{
                background: AURA,
                backgroundSize: "200% 100%",
                filter: "blur(9px)",
                opacity: 0.6,
              }}
            />
            {/* gradient border ring (masked so only the 3px edge paints) */}
            <div
              data-aura-ring
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10 rounded-[32px]"
              style={{
                padding: "3px",
                background: AURA,
                backgroundSize: "200% 100%",
                WebkitMask:
                  "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
              }}
            />
          </div>

          {/* white pill fill + label */}
          <div
            className="relative flex items-center justify-center rounded-[32px] px-[20px] py-[7px]"
            style={{
              background: "linear-gradient(to bottom, #ffffff, #efefef 107.69%)",
              boxShadow:
                "inset 0px -2px 1px 0px #f2f2f2, inset 0px -2px 2px 0px rgba(0,0,0,0.5)",
            }}
          >
            <span className="whitespace-nowrap font-product text-[21.333px] leading-none text-[#263138]">
              creating your board
            </span>
          </div>
        </div>
      </div>

      {/* Pointer cursor — rests below-right of the button, then drifts onto it. */}
      <div ref={cursorRef} className="absolute left-[292.5px] top-[229.5px] flex size-[30.619px] items-center justify-center">
        <Image
          src="/cards/cursor.svg"
          alt=""
          width={25}
          height={25}
          unoptimized
          className="[transform:rotate(-75deg)]"
        />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { CheckMark } from "@/components/ui/icons";

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

// Horizontal padding baked into every pill width we tween to. Matches the glass
// pill's rest px so the padding reads identical as the box grows/shrinks.
const PAD_X = 26.667;

// The three pill states, in sequence.
const START_LABEL = "let’s get started";
const CREATING_LABEL = "creating your board";
const READY_LABEL = "board ready";

// Pill fills. Glass = translucent white over blur; white = the delivered look.
// backgroundColor is animated (white alpha 0.10 → 1) rather than a gradient so
// the colour change is interpolable; the inset shadow fades in alongside.
const GLASS_BG = "rgba(255,255,255,0.10)";
const GLASS_BORDER = "rgba(255,255,255,0.5)";
const WHITE_BG = "#ffffff";
const WHITE_BORDER = "rgba(255,255,255,0)";
const WHITE_SHADOW =
  "inset 0px -2px 1px 0px #f2f2f2, inset 0px -2px 2px 0px rgba(0,0,0,0.5)";
// Same two-layer shape at zero so GSAP interpolates each layer cleanly.
const NO_SHADOW =
  "inset 0px 0px 0px 0px rgba(242,242,242,0), inset 0px 0px 0px 0px rgba(0,0,0,0)";

/** Per-character roll-up unit: an overflow-clipped wrapper + the mover GSAP
 *  slides up. Spaces render as an inert `whitespace-pre` spacer (a bare space
 *  inside an inline-block clip collapses to zero width) so word gaps survive
 *  the split; only the letters carry [data-char] and animate. */
function RollingText({ text }: { text: string }) {
  return (
    <>
      {text.split("").map((c, i) =>
        c === " " ? (
          <span key={i} aria-hidden className="inline-block whitespace-pre">
            {" "}
          </span>
        ) : (
          <span key={i} className="inline-block overflow-hidden align-bottom">
            <span data-char className="inline-block">
              {c}
            </span>
          </span>
        ),
      )}
    </>
  );
}

/**
 * Card3 "subscribe" media (Figma start 220:163 → end 124:265).
 *
 * A self-running, looping micro-interaction that reads as onboarding:
 *   rest → the pointer drifts onto the "let's get started" glass pill →
 *   click-pop → the SAME pill morphs (colour glass→white, width expands to fit
 *   the text) into "creating your board" with its gold→green aura → then flips
 *   to "✓ board ready" (the check springs in) → hold → reset → repeat.
 *
 * ONE persistent pill morphs the whole way through (not a crossfade of separate
 * boxes): GSAP tweens its `width` to each state's measured text width + padding
 * and cross-tweens the fill's backgroundColor/border/boxShadow, so the colour
 * change is smooth and the box grows/shrinks "as per the text". The centering
 * wrapper owns the -translate-x-1/2 (which GSAP would otherwise clobber), so the
 * pill expands from its centre. Three label layers stack inside; only one shows
 * at a time. GSAP only animates width/scale/opacity/colour. The timeline is
 * paused until the card scrolls into view and bails entirely under
 * prefers-reduced-motion (the static glass start state remains).
 */
export default function SubscribeMedia() {
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const label0Ref = useRef<HTMLSpanElement>(null);
  const layer1Ref = useRef<HTMLDivElement>(null);
  const text1Ref = useRef<HTMLSpanElement>(null);
  const spinnerRef = useRef<HTMLSpanElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const text2Ref = useRef<HTMLSpanElement>(null);
  const checkRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const pill = pillRef.current;
    const fill = fillRef.current;
    const glow = glowRef.current;
    const ring = ringRef.current;
    const cursor = cursorRef.current;
    const label0 = label0Ref.current;
    const layer1 = layer1Ref.current;
    const text1 = text1Ref.current;
    const spinner = spinnerRef.current;
    const layer2 = layer2Ref.current;
    const text2 = text2Ref.current;
    const check = checkRef.current;
    if (
      !root || !pill || !fill || !glow || !ring || !cursor ||
      !label0 || !layer1 || !text1 || !spinner || !layer2 || !text2 || !check
    )
      return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const chars1 = gsap.utils.toArray<HTMLElement>(text1.querySelectorAll("[data-char]"));
    const chars2 = gsap.utils.toArray<HTMLElement>(text2.querySelectorAll("[data-char]"));

    const ctx = gsap.context(() => {
      // Widths each state morphs to: the rendered text width + symmetric padding.
      // W0 uses the pill's natural (label0-driven) box so rest == measured.
      const W0 = pill.offsetWidth;
      const W1 = text1.offsetWidth + 2 * PAD_X;
      const W2 = text2.offsetWidth + 2 * PAD_X;

      gsap.set(pill, { width: W0 });
      gsap.set(fill, { backgroundColor: GLASS_BG, borderColor: GLASS_BORDER, boxShadow: NO_SHADOW });
      gsap.set([glow, ring], { autoAlpha: 0 });
      gsap.set([layer1, layer2], { autoAlpha: 0 });
      gsap.set(label0, { autoAlpha: 1 });
      gsap.set([chars1, chars2], { yPercent: 110 });
      gsap.set(check, { scale: 0 });
      gsap.set(cursor, { x: 0, y: 0, scale: 1, autoAlpha: 0 });

      // Continuous aura sweep — cheap, only visible while the white pill is up.
      const sweep = gsap.to([ring, glow], {
        backgroundPosition: "-200% 0",
        duration: 2.4,
        ease: "none",
        repeat: -1,
        paused: true,
      });

      // Spinner ring rotation — only visible while "creating your board" is up.
      const spin = gsap.to(spinner, {
        rotation: 360,
        duration: 0.9,
        ease: "none",
        repeat: -1,
        paused: true,
      });

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5, paused: true });
      tl
        // rest — the pointer fades in together with the glass button. Position 0
        // covers the first loop (the button is already visible at t=0); on later
        // loops the cursor is already faded in from the reset below, so this is a
        // no-op and the real shared fade happens at "reset".
        .to({}, { duration: 0.7 })
        .to(cursor, { autoAlpha: 1, duration: 0.32, ease: "power2.out" }, 0)
        // cursor drifts onto the button
        .to(cursor, { x: CURSOR_DX, y: CURSOR_DY, duration: 0.8, ease: "power2.inOut" })
        // click-pop (pill + cursor tap together)
        .to(pill, { scale: 0.94, duration: 0.09, ease: "power2.in" })
        .to(cursor, { scale: 0.82, duration: 0.09, ease: "power2.in" }, "<")
        .to(pill, { scale: 1.03, duration: 0.15, ease: "back.out(3)" })
        .to(cursor, { scale: 1, duration: 0.15, ease: "back.out(3)" }, "<")
        .to(pill, { scale: 1, duration: 0.1 })
        // MORPH → "creating your board": colour glass→white + box expands to fit
        .addLabel("morph")
        .to(label0, { autoAlpha: 0, duration: 0.2, ease: "power2.out" }, "morph")
        .to(cursor, { autoAlpha: 0, duration: 0.22, ease: "power2.out" }, "morph")
        .to(
          fill,
          { backgroundColor: WHITE_BG, borderColor: WHITE_BORDER, boxShadow: WHITE_SHADOW, duration: 0.36, ease: "power2.inOut" },
          "morph"
        )
        .to(pill, { width: W1, duration: 0.36, ease: "power2.inOut" }, "morph")
        .to(glow, { autoAlpha: 0.6, duration: 0.3, ease: "power2.out" }, "morph+=0.1")
        .to(ring, { autoAlpha: 1, duration: 0.3, ease: "power2.out" }, "morph+=0.1")
        .set(layer1, { autoAlpha: 1 }, "morph+=0.18")
        .to(chars1, { yPercent: 0, duration: 0.5, ease: "power3.out", stagger: 0.03 }, "morph+=0.2")
        // hold — "creating your board" + spinning loader sit for ~1.5s
        .to({}, { duration: 1.5 })
        // MORPH → "board ready": the whole "creating" unit (loader + text) fades
        // out together as ONE thing (pill stays at W1, so the loader never spills
        // past the shrinking edge), THEN the pill contracts and "✓ board ready"
        // springs in.
        .addLabel("ready")
        .to(layer1, { autoAlpha: 0, duration: 0.3, ease: "power2.in" }, "ready")
        // contract only once "creating" (and its loader) is fully gone
        .to(pill, { width: W2, duration: 0.4, ease: "power2.inOut" }, "ready+=0.32")
        .set(layer2, { autoAlpha: 1 }, "ready+=0.36")
        .to(chars2, { yPercent: 0, duration: 0.5, ease: "power3.out", stagger: 0.03 }, "ready+=0.4")
        .fromTo(check, { scale: 0 }, { scale: 1, duration: 0.34, ease: "back.out(3)" }, "ready+=0.44")
        // hold — "board ready", glowing
        .to({}, { duration: 1.5 })
        // reset back to the glass start state for the next loop
        .addLabel("reset")
        .to([glow, ring], { autoAlpha: 0, duration: 0.3, ease: "power2.in" }, "reset")
        .to(layer2, { autoAlpha: 0, duration: 0.3, ease: "power2.in" }, "reset")
        .to(
          fill,
          { backgroundColor: GLASS_BG, borderColor: GLASS_BORDER, boxShadow: NO_SHADOW, duration: 0.36, ease: "power2.inOut" },
          "reset"
        )
        .to(pill, { width: W0, duration: 0.36, ease: "power2.inOut" }, "reset")
        .set([chars1, chars2], { yPercent: 110 })
        .set(check, { scale: 0 })
        // the glass button + the pointer fade back in TOGETHER (the moment the
        // button's first state returns), parked at the pointer's start spot.
        .set(cursor, { x: 0, y: 0, scale: 1 })
        .to([label0, cursor], { autoAlpha: 1, duration: 0.32, ease: "power2.out" });

      // Only run while the card is on screen.
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            tl.play();
            sweep.play();
            spin.play();
          } else {
            tl.pause();
            sweep.pause();
            spin.pause();
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
      {/* Centering wrapper (CSS only — owns the -translate-x-1/2 so the pill
          expands from its centre; GSAP animates the inner pill). */}
      <div className="absolute left-1/2 top-[162.5px] -translate-x-1/2">
        <div
          ref={pillRef}
          className="relative inline-flex h-[40px] items-center justify-center rounded-[42.667px] px-[26.667px]"
        >
          {/* aura glow halo — behind the fill, fades in on the white states */}
          <div
            ref={glowRef}
            data-aura-glow
            aria-hidden
            className="pointer-events-none absolute -inset-[3px] rounded-[46px]"
            style={{ background: AURA, backgroundSize: "200% 100%", filter: "blur(9px)", opacity: 0 }}
          />

          {/* the pill fill — GSAP tweens its backgroundColor/border/boxShadow
              from glass to white (this is the "changes colour" surface) */}
          <div
            ref={fillRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[42.667px] border border-solid border-white/50 bg-white/10 backdrop-blur-[2.667px]"
          />

          {/* gradient border ring (masked so only the 3px edge paints) */}
          <div
            ref={ringRef}
            data-aura-ring
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[42.667px]"
            style={{
              padding: "3px",
              background: AURA,
              backgroundSize: "200% 100%",
              WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              opacity: 0,
            }}
          />

          {/* state 0 — "let's get started" (in flow, so the pill sizes to it at
              rest / SSR / no-JS; overflows invisibly once hidden during morph) */}
          <span
            ref={label0Ref}
            className="relative whitespace-nowrap font-product text-[21.333px] leading-none text-white"
          >
            {START_LABEL}
          </span>

          {/* state 1 — "creating your board" (dark ink on the white pill) */}
          <div
            ref={layer1Ref}
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ opacity: 0 }}
          >
            <span
              ref={text1Ref}
              className="flex items-center gap-[8px] whitespace-nowrap font-product text-[21.333px] leading-[1.2] text-[#263138]"
            >
              {/* Spinner — a ring of dots with a graduated opacity trail; the
                  ring rotates (GSAP, shared ticker) so the bright dot travels
                  around, reading as "working". */}
              <span ref={spinnerRef} className="relative inline-block size-[16px] shrink-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute left-1/2 top-1/2 size-[2.4px] rounded-full bg-[#263138]"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-6px)`,
                      opacity: 0.15 + (i / 7) * 0.85,
                    }}
                  />
                ))}
              </span>
              <span className="inline-block">
                <RollingText text={CREATING_LABEL} />
              </span>
            </span>
          </div>

          {/* state 2 — "✓ board ready" (same tick as the receive "delivered" pill) */}
          <div
            ref={layer2Ref}
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ opacity: 0 }}
          >
            <span
              ref={text2Ref}
              className="flex items-center gap-[8px] whitespace-nowrap font-product text-[21.333px] leading-[1.2] text-[#263138]"
            >
              <span ref={checkRef} className="inline-flex shrink-0 text-[#263138]">
                <CheckMark width={17} height={17} aria-hidden />
              </span>
              <span className="inline-block">
                <RollingText text={READY_LABEL} />
              </span>
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
          className="[transform:rotate(-75deg)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
        />
      </div>
    </div>
  );
}

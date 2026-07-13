"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { CheckMark, SendHorizontal } from "@/components/ui/icons";
import { ACTIVE_REQUEST, REQUEST_QUEUE } from "./cards-data";
import { onMediaRelease } from "./media-gate";

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// The stack fades out toward the "request" title; this is also the viewport the
// rows push through as the active one expands and the queue shifts up.
const FADE = "linear-gradient(to bottom, black 74%, transparent 100%)";

// Row + card geometry (Figma 220:176 / 140:13801).
const ROW_H = 44.67; // collapsed pill height
const CARD_H = 205; // expanded brief-card height

// The typed brief (Figma 220:181).
const BRIEF =
  "hey, need a landing page for our seed round launch. brand's mostly done, i'll drop the figma. should feel fast and a bit premium, think linear not corporate. hero, social proof, pricing, faq. can we get a first look by fri";

// Same gold→green aura as the subscribe/receive pills (get_design_context
// flattens it to a flat #ffe8b7). The siri-style rainbow from demo.html, driven
// as a CONIC gradient by --aura-angle so the colour ORBITS the rim (matching the
// hero CTAs); endpoints match (#5ea8ff → #5ea8ff) so a revolution has no seam.
const AURA =
  "conic-gradient(from calc(var(--aura-angle, 0) * 1deg), #5ea8ff, #a06bff, #ff6ec7, #ff9d5c, #ffe36e, #5ef2c8, #5ea8ff)";

// Cursor rest offset (down-right of the send button) it drifts up from, applied
// as a GSAP transform so the wrapper keeps owning the base landing position.
// The landing left/top (and this offset) are hand-tuned, like the subscribe
// cursor — nudge if the tip doesn't sit on the button.
const CURSOR_OFF_X = 30;
const CURSOR_OFF_Y = 44;

/** A collapsed request pill row (the queue below the active one). */
function QueueRow({ task, tag }: { task: string; tag: string }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[37px] border border-solid border-white/50 bg-white/10"
      style={{ height: ROW_H }}
    >
      <span className="absolute left-[26px] top-1/2 -translate-y-1/2 whitespace-nowrap font-product text-[16px] leading-none text-white">
        {task}
      </span>
      <span className="absolute right-[11px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-[31px] bg-white px-[9.578px] py-[4.789px] text-[10px] leading-[1.5] text-[#263138]">
        {tag}
      </span>
    </div>
  );
}

/** The three brief-toolbar icons (Figma 220:182/184/186), inlined white. */
function SparkleSvg() {
  return (
    <svg viewBox="0 0 24 24" className="size-full">
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        // toFixed(3): full-precision floats serialize differently between the
        // server and client renders (last-digit drift → hydration mismatch);
        // 3 decimals is identical on both and far beyond visual fidelity here.
        const at = (r: number, f: (n: number) => number) =>
          (12 + f(a) * r).toFixed(3);
        return (
          <line
            key={i}
            x1={at(3.4, Math.cos)}
            y1={at(3.4, Math.sin)}
            x2={at(9.5, Math.cos)}
            y2={at(9.5, Math.sin)}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        );
      })}
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

function LinesSvg() {
  return (
    <svg viewBox="0 0 24 24" className="size-full" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="6" x2="15" y2="6" />
      <line x1="4" y1="11" x2="20" y2="11" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <line x1="4" y1="21" x2="16" y2="21" />
    </svg>
  );
}

function CopySvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-full"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/** Dot-ring loader (same as the subscribe "creating" spinner) — a ring of dots
 *  with a graduated opacity trail; the parent is rotated so it reads as motion. */
function SpinnerDots() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 size-[2.4px] rounded-full bg-[#263138]"
          style={{
            transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-7px)`,
            opacity: 0.15 + (i / 7) * 0.85,
          }}
        />
      ))}
    </>
  );
}

/**
 * Card2 "request" media (Figma start 140:13791 → expanded 220:176 → send 343:171).
 *
 * A looping "write a request" beat: the top pill expands into the "New Landing
 * Page" brief card, the brief types out under a blinking caret, then a pointer
 * drifts in and clicks the send button — it glows (gold→green aura), a loader
 * spins, resolves to a tick, and the row compacts back into its pill as the
 * queue glides up.
 *
 * Only the top row morphs; growing its height reflows the flex column so the
 * queue naturally pushes down/up. GSAP animates transforms/height/opacity; the
 * caret and typewriter are driven off a proxy tween. Paused off-screen; bails
 * under prefers-reduced-motion (the static pill stack remains).
 */
export default function RequestMedia() {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const collapsedRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const briefTextRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const sendRef = useRef<HTMLSpanElement>(null);
  const sendGlowRef = useRef<HTMLSpanElement>(null);
  const sendRingRef = useRef<HTMLSpanElement>(null);
  const sendIconRef = useRef<HTMLSpanElement>(null);
  const sendSpinnerRef = useRef<HTMLSpanElement>(null);
  const sendCheckRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const active = activeRef.current;
    const collapsed = collapsedRef.current;
    const expanded = expandedRef.current;
    const briefText = briefTextRef.current;
    const caret = caretRef.current;
    const sendBtn = sendRef.current;
    const sendGlow = sendGlowRef.current;
    const sendRing = sendRingRef.current;
    const sendIcon = sendIconRef.current;
    const sendSpinner = sendSpinnerRef.current;
    const sendCheck = sendCheckRef.current;
    const cursor = cursorRef.current;
    if (
      !root || !active || !collapsed || !expanded || !briefText || !caret ||
      !sendBtn || !sendGlow || !sendRing || !sendIcon || !sendSpinner || !sendCheck || !cursor
    )
      return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const ctx = gsap.context(() => {
      gsap.set(active, { height: ROW_H, borderRadius: 37, y: 0, autoAlpha: 1 });
      gsap.set(collapsed, { autoAlpha: 1 });
      gsap.set(expanded, { autoAlpha: 0 });
      gsap.set([sendGlow, sendRing, sendSpinner], { autoAlpha: 0 });
      gsap.set(sendCheck, { autoAlpha: 0, scale: 0 });
      gsap.set(sendIcon, { autoAlpha: 1 });
      gsap.set(sendBtn, { scale: 1 });
      gsap.set(cursor, { x: CURSOR_OFF_X, y: CURSOR_OFF_Y, scale: 1, autoAlpha: 0 });
      briefText.textContent = "";

      // Blinking caret — always ticking; only visible while the card is open.
      const blink = gsap.to(caret, {
        opacity: 0,
        duration: 0.5,
        ease: "steps(1)",
        repeat: -1,
        yoyo: true,
        paused: true,
      });

      // Continuous aura orbit + loader spin — only visible after the click. The
      // rainbow orbits the rim by driving --aura-angle 0→360 on the send chip
      // (inherited by glow + ring). Rides the shared GSAP ticker (no private rAF).
      const angle = { v: 0 };
      const sweep = gsap.to(angle, {
        v: 360,
        duration: 2.6,
        ease: "none",
        repeat: -1,
        paused: true,
        onUpdate: () =>
          sendBtn.style.setProperty("--aura-angle", String(angle.v)),
      });
      const spin = gsap.to(sendSpinner, {
        rotation: 360,
        duration: 0.9,
        ease: "none",
        repeat: -1,
        paused: true,
      });

      const typed = { n: 0 };
      // The tween runs `n` continuously, but Math.round lands on the same integer
      // for several consecutive frames — so guard against re-writing (and thus
      // re-laying-out the <p>) an identical substring every frame.
      let lastCount = -1;
      const paint = () => {
        const count = Math.round(typed.n);
        if (count === lastCount) return;
        lastCount = count;
        briefText.textContent = BRIEF.slice(0, count);
      };

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4, paused: true });
      tl
        // expand the top pill into the brief card (queue pushes down) — a slow,
        // eased grow so the box unfolds smoothly rather than snapping open
        .to(active, { height: CARD_H, borderRadius: 20, duration: 0.95, ease: "power2.inOut" })
        .to(collapsed, { autoAlpha: 0, duration: 0.3, ease: "power1.out" }, "<")
        .to(expanded, { autoAlpha: 1, duration: 0.45, ease: "power1.out" }, "<0.25")
        // type the brief under the caret (the tools + send button are already
        // visible — they faded in with the expanded card above)
        .fromTo(typed, { n: 0 }, { n: BRIEF.length, duration: 3.6, ease: "none", onUpdate: paint }, ">-0.05")
        // brief finished — the pointer drifts in and onto the send button
        .addLabel("send")
        .to(cursor, { autoAlpha: 1, duration: 0.3, ease: "power2.out" }, "send")
        .to(cursor, { x: 0, y: 0, duration: 0.75, ease: "power2.inOut" }, "send")
        // click-pop (button + cursor tap together)
        .to(sendBtn, { scale: 0.9, duration: 0.09, ease: "power2.in" })
        .to(cursor, { scale: 0.82, duration: 0.09, ease: "power2.in" }, "<")
        .to(sendBtn, { scale: 1.08, duration: 0.15, ease: "back.out(3)" })
        .to(cursor, { scale: 1, duration: 0.15, ease: "back.out(3)" }, "<")
        .to(sendBtn, { scale: 1, duration: 0.1 })
        // the button glows, the pointer leaves, and the send glyph gives way to
        // the spinning loader
        .addLabel("sent")
        .to(sendGlow, { autoAlpha: 0.6, duration: 0.3, ease: "power2.out" }, "sent")
        .to(sendRing, { autoAlpha: 1, duration: 0.3, ease: "power2.out" }, "sent")
        .to(cursor, { autoAlpha: 0, duration: 0.25, ease: "power2.out" }, "sent")
        .to(sendIcon, { autoAlpha: 0, duration: 0.2, ease: "power2.out" }, "sent")
        .set(sendSpinner, { autoAlpha: 1 }, "sent+=0.18")
        // loading
        .to({}, { duration: 1.3 })
        // loader resolves to the tick
        .addLabel("done")
        .to(sendSpinner, { autoAlpha: 0, duration: 0.2, ease: "power2.out" }, "done")
        .set(sendCheck, { autoAlpha: 1 }, "done+=0.1")
        .fromTo(sendCheck, { scale: 0 }, { scale: 1, duration: 0.34, ease: "back.out(3)" }, "done+=0.1")
        // hold the delivered state
        .to({}, { duration: 0.8 })
        // compact back down into the collapsed "new landing page" pill (queue
        // glides up), crossfading the brief out and the label in as it shrinks —
        // the expanded card (incl. the glowing button + tick) fades with it.
        .addLabel("compact")
        .to(active, { height: ROW_H, borderRadius: 37, duration: 0.95, ease: "power2.inOut" }, "compact")
        .to(expanded, { autoAlpha: 0, duration: 0.45, ease: "power1.out" }, "compact")
        .to(collapsed, { autoAlpha: 1, duration: 0.5, ease: "power1.out" }, "compact+=0.25")
        // clear the typed brief + reset the send button and pointer for next pass
        .add(() => {
          typed.n = 0;
          lastCount = -1;
          briefText.textContent = "";
        })
        .set([sendGlow, sendRing, sendSpinner], { autoAlpha: 0 })
        .set(sendCheck, { autoAlpha: 0, scale: 0 })
        .set(sendIcon, { autoAlpha: 1 })
        .set(sendBtn, { scale: 1 })
        .set(cursor, { x: CURSOR_OFF_X, y: CURSOR_OFF_Y, scale: 1, autoAlpha: 0 });

      // Held until the card's entrance lands (Option D): CardsReveal releases
      // this media as the panel finishes blur-rising, so the conveyor starts in
      // step with the left→right cascade rather than on its own. After release
      // the observer just pauses/resumes it as the card scrolls out / back in.
      let released = false;
      let onScreen = false;
      const play = () => {
        tl.play();
        blink.play();
        sweep.play();
        spin.play();
      };
      const pause = () => {
        tl.pause();
        blink.pause();
        sweep.pause();
        spin.pause();
      };

      const io = new IntersectionObserver(
        ([entry]) => {
          onScreen = entry.isIntersecting;
          if (!released) return; // hold until the card lands
          if (onScreen) play();
          else pause();
        },
        { threshold: 0.15 }
      );
      io.observe(root);

      const unrelease = onMediaRelease("request", () => {
        released = true;
        if (onScreen) play();
      });

      return () => {
        io.disconnect();
        unrelease();
      };
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="absolute inset-0">
      <div
        className="absolute left-[31px] top-[23px] h-[288px] w-[378px] overflow-hidden"
        style={{ WebkitMaskImage: FADE, maskImage: FADE }}
      >
        <div className="flex flex-col gap-[12px]">
          {/* ACTIVE ROW — morphs between pill and brief card. */}
          <div
            ref={activeRef}
            className="relative w-full shrink-0 overflow-hidden border border-solid border-white/50 bg-white/10"
            style={{ height: ROW_H, borderRadius: 37 }}
          >
            {/* collapsed: the active request label */}
            <div ref={collapsedRef} className="absolute inset-0">
              <span className="absolute left-[26px] top-1/2 -translate-y-1/2 whitespace-nowrap font-product text-[16px] leading-none text-white">
                {ACTIVE_REQUEST.task}
              </span>
              <span className="absolute right-[11px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-[31px] bg-white px-[9.578px] py-[4.789px] text-[10px] leading-[1.5] text-[#263138]">
                {ACTIVE_REQUEST.tag}
              </span>
            </div>

            {/* expanded: "New Landing Page" brief */}
            <div ref={expandedRef} className="absolute inset-0">
              <div className="absolute left-[18px] right-[16px] top-[11px] flex items-center justify-between">
                <span className="whitespace-nowrap font-product text-[20px] leading-none text-white">
                  New Landing Page
                </span>
                <span className="whitespace-nowrap rounded-[31px] bg-white px-[9.578px] py-[4.789px] text-[10px] leading-[1.5] text-[#263138]">
                  {ACTIVE_REQUEST.tag}
                </span>
              </div>

              <p className="absolute left-[17px] top-[51px] w-[310px] font-light text-[14px] leading-[1.1] text-white">
                <span ref={briefTextRef} />
                <span
                  ref={caretRef}
                  className="ml-[1px] inline-block h-[13px] w-[1.5px] translate-y-[2px] bg-white align-baseline"
                />
              </p>

              <div className="absolute left-[17px] top-[159px] flex gap-[5px]">
                <span className="inline-block size-[24px] text-white">
                  <SparkleSvg />
                </span>
                <span className="inline-block size-[24px] text-white">
                  <LinesSvg />
                </span>
                <span className="inline-block size-[24px] text-white">
                  <CopySvg />
                </span>
              </div>

              {/* Send button (Figma 343:171) — white chip + dark send-horizontal
                  glyph, bottom-right of the brief; same inset-shadow as the other
                  white pills. On click it glows (gold→green aura) and its glyph
                  swaps for the loader then the tick. */}
              <span
                ref={sendRef}
                aria-hidden
                className="absolute right-[15px] top-[150px] size-[38px]"
              >
                {/* aura glow halo — behind the chip */}
                <span
                  ref={sendGlowRef}
                  className="pointer-events-none absolute -inset-[3px] rounded-full"
                  style={{ background: AURA, filter: "blur(9px)", opacity: 0 }}
                />
                {/* white chip + swappable content */}
                <span
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-white text-[#263138]"
                  style={{
                    boxShadow:
                      "inset 0px -2px 1px 0px #f2f2f2, inset 0px -2px 2px 0px rgba(0,0,0,0.5)",
                  }}
                >
                  <span ref={sendIconRef} className="relative inline-flex">
                    <SendHorizontal className="size-[18px]" />
                  </span>
                  <span ref={sendSpinnerRef} className="pointer-events-none absolute inset-0" style={{ opacity: 0 }}>
                    <SpinnerDots />
                  </span>
                  <span
                    ref={sendCheckRef}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    style={{ opacity: 0 }}
                  >
                    <CheckMark width={18} height={18} />
                  </span>
                </span>
                {/* gradient border ring (masked so only the edge paints) */}
                <span
                  ref={sendRingRef}
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    padding: "3px",
                    background: AURA,
                    WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                    opacity: 0,
                  }}
                />
              </span>
            </div>
          </div>

          {/* Static queue below. */}
          {REQUEST_QUEUE.map((row) => (
            <QueueRow key={row.task} task={row.task} tag={row.tag} />
          ))}
        </div>
      </div>

      {/* Pointer cursor (same asset as the subscribe card) — parked below-right
          of the send button, drifts up onto it, then taps. Landing left/top is
          hand-tuned to the button centre (~root 375,192). */}
      <div
        ref={cursorRef}
        aria-hidden
        className="absolute left-[360px] top-[178px] flex size-[30.619px] items-center justify-center"
        style={{ opacity: 0 }}
      >
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

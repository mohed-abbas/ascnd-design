"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { REQUEST_PLACEHOLDER } from "./cards-data";

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

// The stack fades out toward the "request" title; this is also the viewport the
// rows push through as the active one expands and the queue shifts up.
const FADE = "linear-gradient(to bottom, black 74%, transparent 100%)";

// Row + card geometry (Figma 220:176 / 140:13801).
const ROW_H = 44.67; // collapsed pill height
const CARD_H = 205; // expanded brief-card height

// The typed brief (Figma 220:181) and the tag that cycles on the active row.
const BRIEF =
  "hey, need a landing page for our seed round launch. brand's mostly done, i'll drop the figma. should feel fast and a bit premium, think linear not corporate. hero, social proof, pricing, faq. can we get a first look by fri";
const ACTIVE_TAGS = ["UI/UX", "Design", "Wireframe", "UI/UX", "UI/UX"];
const QUEUE_TAGS = ["Design", "Wireframe", "UI/UX", "UI/UX"]; // the static rows below

/** A collapsed "request anything…" pill row (the queue below the active one). */
function QueueRow({ tag }: { tag: string }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[37px] border border-solid border-white/50 bg-white/10"
      style={{ height: ROW_H }}
    >
      <span className="absolute left-[26px] top-1/2 -translate-y-1/2 whitespace-nowrap font-product text-[16px] leading-none text-white">
        {REQUEST_PLACEHOLDER}
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
        return (
          <line
            key={i}
            x1={12 + Math.cos(a) * 3.4}
            y1={12 + Math.sin(a) * 3.4}
            x2={12 + Math.cos(a) * 9.5}
            y2={12 + Math.sin(a) * 9.5}
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

/**
 * Card2 "request" media (Figma start 140:13791 → expanded 220:176).
 *
 * A looping "write a request" beat: the top pill expands into the "New Landing
 * Page" brief card, the brief types out under a blinking caret, the three tool
 * icons pop in, then the finished request submits (flies up) and the queue
 * shifts up so the next row becomes active — its tag cycling each pass.
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
  const tool0 = useRef<HTMLSpanElement>(null);
  const tool1 = useRef<HTMLSpanElement>(null);
  const tool2 = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const active = activeRef.current;
    const collapsed = collapsedRef.current;
    const expanded = expandedRef.current;
    const briefText = briefTextRef.current;
    const caret = caretRef.current;
    if (!root || !active || !collapsed || !expanded || !briefText || !caret) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const tools = [tool0.current, tool1.current, tool2.current].filter(Boolean) as HTMLElement[];
    const activeTagEls = gsap.utils.toArray<HTMLElement>(active.querySelectorAll("[data-active-tag]"));
    let pass = 0;

    const ctx = gsap.context(() => {
      gsap.set(active, { height: ROW_H, borderRadius: 37, y: 0, autoAlpha: 1 });
      gsap.set(collapsed, { autoAlpha: 1 });
      gsap.set(expanded, { autoAlpha: 0 });
      gsap.set(tools, { autoAlpha: 0, scale: 0.4 });
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

      const typed = { n: 0 };
      const paint = () => {
        briefText.textContent = BRIEF.slice(0, Math.round(typed.n));
      };

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4, paused: true });
      tl
        // expand the top pill into the brief card (queue pushes down) — a slow,
        // eased grow so the box unfolds smoothly rather than snapping open
        .to(active, { height: CARD_H, borderRadius: 20, duration: 0.95, ease: "power2.inOut" })
        .to(collapsed, { autoAlpha: 0, duration: 0.3, ease: "power1.out" }, "<")
        .to(expanded, { autoAlpha: 1, duration: 0.45, ease: "power1.out" }, "<0.25")
        // type the brief under the caret
        .fromTo(typed, { n: 0 }, { n: BRIEF.length, duration: 2.4, ease: "none", onUpdate: paint }, ">-0.05")
        // tools pop in
        .to(tools, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(2)", stagger: 0.08 }, ">-0.4")
        // hold the finished request
        .to({}, { duration: 1.0 })
        // compact back down into the "request anything…" pill (queue glides up),
        // crossfading the brief out and the placeholder in as it shrinks — stays
        // in place the whole time so it never leaves an empty gap. Tag cycles so
        // the pill returns as the next request.
        .addLabel("compact")
        .add(() => {
          pass += 1;
          const tag = ACTIVE_TAGS[pass % ACTIVE_TAGS.length];
          activeTagEls.forEach((el) => (el.textContent = tag));
        })
        .to(active, { height: ROW_H, borderRadius: 37, duration: 0.95, ease: "power2.inOut" }, "compact")
        .to(tools, { autoAlpha: 0, duration: 0.3, ease: "power1.out" }, "compact")
        .to(expanded, { autoAlpha: 0, duration: 0.45, ease: "power1.out" }, "compact")
        .to(collapsed, { autoAlpha: 1, duration: 0.5, ease: "power1.out" }, "compact+=0.25")
        // clear the typed brief + reset the tools for the next pass
        .add(() => {
          typed.n = 0;
          briefText.textContent = "";
        })
        .set(tools, { scale: 0.4 });

      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            tl.play();
            blink.play();
          } else {
            tl.pause();
            blink.pause();
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
            {/* collapsed: "request anything…" */}
            <div ref={collapsedRef} className="absolute inset-0">
              <span className="absolute left-[26px] top-1/2 -translate-y-1/2 whitespace-nowrap font-product text-[16px] leading-none text-white">
                {REQUEST_PLACEHOLDER}
              </span>
              <span
                data-active-tag
                className="absolute right-[11px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-[31px] bg-white px-[9.578px] py-[4.789px] text-[10px] leading-[1.5] text-[#263138]"
              >
                UI/UX
              </span>
            </div>

            {/* expanded: "New Landing Page" brief */}
            <div ref={expandedRef} className="absolute inset-0">
              <div className="absolute left-[18px] right-[16px] top-[11px] flex items-center justify-between">
                <span className="whitespace-nowrap font-product text-[20px] leading-none text-white">
                  New Landing Page
                </span>
                <span
                  data-active-tag
                  className="whitespace-nowrap rounded-[31px] bg-white px-[9.578px] py-[4.789px] text-[10px] leading-[1.5] text-[#263138]"
                >
                  UI/UX
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
                <span ref={tool0} className="inline-block size-[24px] text-white">
                  <SparkleSvg />
                </span>
                <span ref={tool1} className="inline-block size-[24px] text-white">
                  <LinesSvg />
                </span>
                <span ref={tool2} className="inline-block size-[24px] text-white">
                  <CopySvg />
                </span>
              </div>
            </div>
          </div>

          {/* Static queue below. */}
          {QUEUE_TAGS.map((tag, i) => (
            <QueueRow key={i} tag={tag} />
          ))}
        </div>
      </div>
    </div>
  );
}

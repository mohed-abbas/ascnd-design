"use client";

import { useState } from "react";
import FaqReveal from "./faq-reveal";
import { PlusIcon } from "./faq-icons";
import { FAQS, type Faq as FaqItem } from "./faq-data";

/**
 * "questions, answered straight" — Figma frame 498:412 (1512×982).
 *
 * A centred FAQ: a mixed-font heading (526:413) over a stack of six glass
 * question pills (526:414). Like every other section it renders at DESIGN SCALE
 * (fixed px, centre-anchored) and stays TRANSPARENT over the shared sky — the
 * Figma mock paints its own #62abff fill + grain, but here the sky is the global
 * fixed <Background/> (fill → grain → clouds) from layout.tsx, so scrolling in
 * stays in one continuous world (no double grain).
 *
 * Layout (content group 526:412, 1128px, viewport-centred):
 *   • Heading (526:413, 49px / −1.47px tracking / 1.1 leading): "questions,
 *     answered " in Product Sans Light + "straight" in Instrument Serif — the
 *     same italic-feel accent the other sections use.
 *   • Pill stack (526:414, gap-15px): each pill (526:415) is 61px tall when
 *     collapsed — a glass card (rounded-20, 1.5px white edge, black 10→5
 *     gradient, white inset veil in place of the Figma 2.9px backdrop-blur —
 *     frost-swept 2026-07-18, docs/backdrop-filter-sweep.md — matching the
 *     page's card convention). The
 *     question (526:416) sits at left-31.5px; the two-tone toggle (526:417) at
 *     the right.
 *
 * INTERACTION (not in the mock — the design only draws the collapsed state):
 * click a pill to expand its answer. Single-open accordion — opening one closes
 * the rest. The expand is a pure-CSS grid-rows 0fr→1fr transition (no JS loop, no
 * layout thrash, idles to zero, and animates in both Chrome and Firefox); the
 * "+" rotates 45° into an "×". Both honour prefers-reduced-motion via
 * `motion-reduce:transition-none`.
 *
 * The heading reveal (faq-reveal.tsx) drives [data-faq-head] with the shared
 * word-by-word blur-rise; markup renders FINISHED (SSR / no-JS / reduced-motion
 * show the full heading), the driver only hides + plays once it knows it'll
 * animate.
 *
 * The question set is a prop (defaulting to the homepage FAQS) so the same
 * section serves the /pricing page with its own subscription-focused list
 * (PRICING_FAQS) — identical design, different copy, one component.
 */
export default function Faq({ faqs = FAQS }: { faqs?: readonly FaqItem[] }) {
  // Single-open accordion: index of the expanded pill, or null when all closed.
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section
      data-faq
      // Desktop content-driven (no min-h-dvh) with the shared rhythm token
      // `py-section` (--gap-section in globals.css — see comparison.tsx), so
      // the sky above and below matches every other boundary on the page.
      // Mobile keeps its full-height layout; the token drops to 12dvh there.
      className="relative flex max-md:min-h-svh w-full items-center justify-center overflow-hidden py-section"
    >
      {/* Content block (526:412), flow-centred so a viewport shorter than the
          stack grows the section (page scrolls) instead of clipping it. */}
      <div className="flex w-[1128px] flex-col items-center gap-[52px] max-md:w-full max-md:gap-[32px] max-md:px-6">
        {/* Word-by-word blur reveal on the heading (see faq-reveal.tsx). */}
        <FaqReveal />

        {/* Heading (526:413) — Product Sans Light with an Instrument Serif
            "straight". */}
        <h2
          data-faq-head
          className="w-full text-center text-display leading-[1.1] tracking-[-0.03em] text-white"
        >
          <span className="font-light">questions, answered </span>
          <span className="font-instrument">straight</span>
        </h2>

        {/* Pill stack (526:414). */}
        <div className="flex w-full flex-col gap-[15px]">
          {faqs.map((faq, i) => {
            const isOpen = open === i;
            const panelId = `faq-panel-${i}`;
            const buttonId = `faq-button-${i}`;
            return (
              <div
                key={faq.question}
                className="overflow-hidden rounded-[20px] border-[1.5px] border-solid border-white/30 bg-gradient-to-b from-black/10 to-black/5 shadow-[inset_0_0_0_999px_rgba(255,255,255,0.06)]"
              >
                {/* Question row (526:415/416/417) — the 61px collapsed pill. */}
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex h-[61px] w-full items-center justify-between gap-[16px] pl-[31.5px] pr-[20.5px] text-left max-md:h-auto max-md:min-h-[56px] max-md:gap-[12px] max-md:py-[14px] max-md:pl-[20px] max-md:pr-[16px]"
                >
                  <span className="text-body-lg font-light leading-[1.1] tracking-[-0.03em] text-white">
                    {faq.question}
                  </span>
                  {/* Two-tone toggle (526:417): rotates 45° into an "×". */}
                  <span
                    aria-hidden
                    className="shrink-0 transition-transform duration-300 ease-out motion-reduce:transition-none"
                    style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
                  >
                    <PlusIcon className="block h-[30px] w-[30px]" />
                  </span>
                </button>

                {/* Answer panel — grid-rows 0fr→1fr expand (no JS loop). */}
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="pb-[24px] pl-[31.5px] pr-[64px] text-body leading-[1.55] tracking-[-0.2px] text-white/70 max-md:pb-[20px] max-md:pl-[20px] max-md:pr-[20px]">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

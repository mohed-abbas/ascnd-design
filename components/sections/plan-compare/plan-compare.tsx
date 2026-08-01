"use client";

import { Fragment, useState } from "react";
import Button from "@/components/ui/button";
import { CheckMark } from "@/components/sections/pricing/pricing-icons";
import PlanCompareReveal from "./plan-compare-reveal";
import { ChevronDown, DontIcon } from "./plan-compare-icons";
import {
  CATEGORIES,
  PLAN_COLUMNS,
  type CompareRow,
  type CompareValue,
} from "./plan-compare-data";

/**
 * "compare plan details" — Figma frame 678:2856.
 *
 * An accordion comparison of the two plans (subscription / fixed sprint). A
 * header row pairs the mixed-font heading (left) with the two plan columns
 * (title + note + shared <Button> CTA, right), then six category rows expand to a
 * three-column table: a feature LABEL, its subscription value, its fixed-sprint
 * value. Like every section it renders at DESIGN SCALE (a centre-anchored 1130px
 * block) and stays TRANSPARENT over the shared sky — the mock's own #62abff fill
 * + grain are intentionally NOT reproduced.
 *
 * The three columns are one CSS-grid track set (447/358/325 = 1130) shared by the
 * header and every body row, so the plan columns sit directly above their value
 * columns (track centres land on the Figma value centres, x≈626 / x≈967.5).
 * Categories toggle INDEPENDENTLY (compare several at once); "how it works" opens
 * by default, matching the design's shown state. Expansion is a pure-CSS
 * grid-rows 0fr→1fr height tween (no measuring, rides no ticker).
 *
 * Rows only exist for "how it works" in the Figma; the other five are awaiting
 * copy (see plan-compare-data.ts) and expand to an empty panel for now.
 *
 * Below md the wide grid can't hold three text columns, so each expanded row is
 * rebuilt as a label over a two-up "subscription / fixed sprint" pair.
 */

// The shared three-column track set. Header and every body row use it, so the
// plan columns sit exactly above their values.
const COLS = "grid-cols-[447px_358px_325px]";

// A faint full-width rule (Figma Line229 / Line230), fading at both ends.
const HAIRLINE = "h-px bg-gradient-to-r from-transparent via-white/25 to-transparent";

// The plan CTAs sit two-up on a phone, so the shared button's desktop padding
// and 16px label are trimmed to keep the longer "book a call" on one line in a
// half-width track. Variant utilities win over the button's own base ones.
const CTA_MOBILE = "max-md:px-[14px] max-md:py-[6px] max-md:text-[14px]";

// The dashed split between the two plans, repeated from the header pair so the
// body's values sit under the plan they belong to with the same rule between
// them. Both halves are 50%, so this always lands on the same midline.
const SPLIT = "border-l-[1.5px] border-dashed border-white/40";

export default function PlanCompare() {
  // Independent open state per category, keyed by category key. "how it works"
  // starts open (the design's shown state).
  const [open, setOpen] = useState<Record<string, boolean>>({
    "how-it-works": true,
  });

  const toggle = (key: string) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <section
      data-plan-compare
      // Shared section rhythm (--gap-section, globals.css — see comparison.tsx):
      // /pricing runs on the same boundary as the homepage.
      className="relative flex w-full items-center justify-center overflow-hidden py-section"
    >
      <div className="w-[1130px] max-w-full max-md:px-6">
        <PlanCompareReveal />

        {/* Header — heading (col 1) + the two plan columns (col 2 / col 3). Below
            md the heading takes a full-width row of its own and the two plans sit
            SIDE BY SIDE beneath it, split by a dashed rule: the section's whole
            job is comparison, and stacking them made the phone read as two
            unrelated offers you had to scroll between. items-stretch is what
            lets that rule run the full height of the taller column. */}
        <div
          className={`grid ${COLS} items-end max-md:grid-cols-2 max-md:items-stretch max-md:gap-y-[28px]`}
        >
          <h2
            data-plan-compare-head
            className="whitespace-nowrap text-display leading-[1.1] tracking-[-0.03em] text-white max-md:col-span-2 max-md:whitespace-normal max-md:text-center"
          >
            <span className="font-light">compare plan </span>
            <span className="font-instrument">details</span>
          </h2>

          {PLAN_COLUMNS.map((col, i) => (
            <div
              key={col.key}
              data-plan-compare-col
              // The divider is the second column's left border, with matching
              // inner padding on both sides, so it lands exactly on the midline
              // (a grid gap-x would push it off-centre). Same dash geometry as
              // the timeline's mobile spine (timeline.tsx).
              className={`flex flex-col items-center gap-[25px] max-md:gap-[16px] max-md:px-[10px] ${
                i > 0
                  ? "max-md:border-l-[1.5px] max-md:border-dashed max-md:border-white/40"
                  : ""
              }`}
            >
              <div className="flex flex-col items-center gap-[5px] text-center text-white max-md:gap-[3px]">
                {/* Two columns on a phone is roughly 150px of track each, which
                    the desktop 31px serif overruns — measured, "subscription"
                    alone needs ~156px. Stepped down so both titles hold one line
                    down to a 320px viewport. */}
                <p className="font-instrument text-[31px] leading-normal max-md:text-[22px]">
                  {col.title}
                </p>
                <p className="text-[16px] font-light leading-normal tracking-[-0.05em] max-md:text-[13px]">
                  {col.note}
                </p>
              </div>
              {/* The booking column links to this page's calendar; the other is
                  still unwired (see PlanColumn.ctaHref). CTA_MOBILE trims the
                  shared button's padding/size so "book a call" clears a half-
                  width track without wrapping. */}
              {col.ctaHref ? (
                <Button
                  variant={col.ctaVariant}
                  href={col.ctaHref}
                  className={CTA_MOBILE}
                >
                  {col.cta}
                </Button>
              ) : (
                <Button variant={col.ctaVariant} className={CTA_MOBILE}>
                  {col.cta}
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Accordion. A rule above the first row, then each category carries a
            bottom rule — so a hairline sits under the header and under every
            category, as the design draws them. */}
        <div data-plan-compare-table className="mt-[26px]">
          <div aria-hidden className={HAIRLINE} />
          {CATEGORIES.map((cat) => {
            const isOpen = !!open[cat.key];
            return (
              <div key={cat.key}>
                <button
                  type="button"
                  onClick={() => toggle(cat.key)}
                  aria-expanded={isOpen}
                  className="group flex w-full items-center justify-between py-[25px] text-left max-md:py-[20px]"
                >
                  {/* The 9px inset is the Figma desktop metric; on a phone the
                      body rows sit flush left, so the icon drops it to share
                      their edge. */}
                  <span className="flex items-center gap-[9px] pl-[9px] text-white transition-opacity group-hover:opacity-80 max-md:pl-0">
                    <cat.Icon className="size-[30px] shrink-0" />
                    <span className="text-[25px] leading-none tracking-[-0.05em] max-md:text-[21px]">
                      {cat.name}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-[31px] w-[30px] shrink-0 text-white transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Height tween via grid-rows 0fr→1fr; the inner clip hides the
                    body while collapsed. */}
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="overflow-hidden">
                    <CategoryBody rows={cat.rows} />
                  </div>
                </div>

                <div aria-hidden className={HAIRLINE} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** The expanded rows for one category — desktop 3-column grid + mobile stack. */
function CategoryBody({ rows }: { rows: readonly CompareRow[] }) {
  if (rows.length === 0) return null;
  return (
    <>
      {/* Desktop: the shared three-column grid, values centred in their tracks. */}
      <div
        className={`grid ${COLS} items-center gap-y-[18px] pb-[26px] max-md:hidden`}
      >
        {rows.map((row) => (
          <Fragment key={row.label}>
            <span className="flex flex-col gap-[2px] pl-[48px]">
              <span className="text-[20px] leading-normal tracking-[-0.01em] text-white">
                {row.label}
              </span>
              {row.note && (
                <span className="text-[13px] leading-snug tracking-[-0.01em] text-white/50">
                  {row.note}
                </span>
              )}
            </span>
            <CompareValue
              value={row.subscription}
              textClass="block text-center text-[20px] leading-normal tracking-[-0.01em] text-white/70"
              iconClass="mx-auto block size-[20px]"
            />
            <CompareValue
              value={row.fixedSprint}
              textClass="block text-center text-[20px] leading-normal tracking-[-0.01em] text-white/70"
              iconClass="mx-auto block size-[20px]"
            />
          </Fragment>
        ))}
      </div>

      {/* Mobile: label over a two-up subscription / fixed-sprint pair. The label
          stays flush with the row's left edge (it is NOT indented to the
          category title — deliberate); the value pair keeps the full width and
          splits on the midline, which is where the header's plan rule falls, so
          one continuous seam runs down the section. */}
      <div className="hidden flex-col gap-[14px] pb-[20px] max-md:flex">
        {rows.map((row) => (
          <div key={row.label} className="border-t border-white/10 pt-[12px]">
            <p className="text-[15px] leading-snug text-white">{row.label}</p>
            {row.note && (
              <p className="mt-[2px] text-[12px] leading-snug text-white/50">
                {row.note}
              </p>
            )}
            <div className="mt-[8px] grid grid-cols-2">
              <div className="pr-[12px]">
                <CompareValue
                  value={row.subscription}
                  textClass="block text-center text-[13px] leading-snug text-white/70"
                  iconClass="mx-auto block size-[18px]"
                />
              </div>
              <div className={`pl-[12px] ${SPLIT}`}>
                <CompareValue
                  value={row.fixedSprint}
                  textClass="block text-center text-[13px] leading-snug text-white/70"
                  iconClass="mx-auto block size-[18px]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * One comparison-cell value: an included tick (reusing the pricing <CheckMark>),
 * an excluded cross (the "what we don't do" <DontIcon>, at full strength to match
 * the section heading's X), or plain text. The marks come from the codebase's
 * existing icon set — no literal ✓/✕ glyphs.
 */
function CompareValue({
  value,
  textClass,
  iconClass,
}: {
  value: CompareValue;
  textClass: string;
  iconClass: string;
}) {
  if (value === "check") return <CheckMark className={iconClass} />;
  if (value === "cross")
    // The X glyph fills less of its 30×30 viewBox than the check does of its
    // 20×20, so at the same box size it reads smaller — scale it up to match.
    return <DontIcon className={`${iconClass} scale-[1.2] text-white`} />;
  return <span className={textClass}>{value}</span>;
}

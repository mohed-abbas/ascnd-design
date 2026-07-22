"use client";

import { Fragment, useState } from "react";
import Button from "@/components/ui/button";
import PlanCompareReveal from "./plan-compare-reveal";
import { ChevronDown } from "./plan-compare-icons";
import { CATEGORIES, PLAN_COLUMNS, type CompareRow } from "./plan-compare-data";

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
      className="relative flex w-full items-center justify-center overflow-hidden py-[25dvh] max-md:py-[12dvh]"
    >
      <div className="w-[1130px] max-w-full max-md:px-6">
        <PlanCompareReveal />

        {/* Header — heading (col 1) + the two plan columns (col 2 / col 3). Below
            md it stacks: heading centred, then the plan columns. */}
        <div
          className={`grid ${COLS} items-end max-md:grid-cols-1 max-md:justify-items-center max-md:gap-y-[28px]`}
        >
          <h2
            data-plan-compare-head
            className="whitespace-nowrap text-display leading-[1.1] tracking-[-0.03em] text-white max-md:whitespace-normal max-md:text-center"
          >
            <span className="font-light">compare plan </span>
            <span className="font-instrument">details</span>
          </h2>

          {PLAN_COLUMNS.map((col) => (
            <div
              key={col.key}
              data-plan-compare-col
              className="flex flex-col items-center gap-[25px]"
            >
              <div className="flex flex-col items-center gap-[5px] text-center text-white">
                <p className="font-instrument text-[31px] leading-normal">
                  {col.title}
                </p>
                <p className="text-[16px] font-light leading-normal tracking-[-0.05em]">
                  {col.note}
                </p>
              </div>
              <Button variant={col.ctaVariant}>{col.cta}</Button>
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
                  <span className="flex items-center gap-[9px] pl-[9px] text-white transition-opacity group-hover:opacity-80">
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
      <div className={`grid ${COLS} gap-y-[18px] pb-[26px] max-md:hidden`}>
        {rows.map((row) => (
          <Fragment key={row.label}>
            <span className="pl-[9px] text-[16px] leading-normal tracking-[-0.01em] text-white">
              {row.label}
            </span>
            <span className="text-center text-[16px] leading-normal tracking-[-0.01em] text-white/70">
              {row.subscription}
            </span>
            <span className="text-center text-[16px] leading-normal tracking-[-0.01em] text-white/70">
              {row.fixedSprint}
            </span>
          </Fragment>
        ))}
      </div>

      {/* Mobile: label over a two-up subscription / fixed-sprint pair. */}
      <div className="hidden flex-col gap-[14px] pb-[20px] max-md:flex">
        {rows.map((row) => (
          <div key={row.label} className="border-t border-white/10 pt-[12px]">
            <p className="mb-[8px] text-[15px] leading-snug text-white">
              {row.label}
            </p>
            <div className="grid grid-cols-2 gap-[12px]">
              <div>
                <span className="block text-[11px] uppercase tracking-[0.08em] text-white/40">
                  subscription
                </span>
                <span className="text-[13px] leading-snug text-white/70">
                  {row.subscription}
                </span>
              </div>
              <div>
                <span className="block text-[11px] uppercase tracking-[0.08em] text-white/40">
                  fixed sprint
                </span>
                <span className="text-[13px] leading-snug text-white/70">
                  {row.fixedSprint}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

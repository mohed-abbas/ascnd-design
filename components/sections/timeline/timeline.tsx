import Image from "next/image";
import type { ReactNode } from "react";
import TimelineAura from "./timeline-aura";
import { AscndMark, Check, Pause, Refresh } from "./timeline-icons";
import {
  AND_UP_WE_GO,
  BANKED_GRID,
  BANKED_LABEL,
  beat,
  type Cell,
  DESIGNS_IN_REVIEW,
  HEADING,
} from "./timeline-data";
import { DOTS, PATH_D, PATH_TRANSFORM } from "./timeline-path";

/**
 * "your first month, plotted" — Figma "TimeLine" frame (797:439, 1512×982).
 *
 * A full-bleed "journey" timeline: a winding dotted spine threads five milestone
 * beats (day 1 → day 23) plus a floating "Designs in review" label, ending
 * top-right at the ascnd mark ("and up we go"). Sits between <PlanCompare/> and
 * <BookACall/> on /pricing and, like every section, renders TRANSPARENT over the
 * shared sky (the mock's own #62abff + grain are intentionally not reproduced).
 *
 * SCALING: the whole 1512×982 composition is one scalable "stage" — a
 * `@container` wrapper with every size in `cqw` (1cqw = 1% of the stage width)
 * and positions in `%`, so the artwork scales as a single unit with the viewport
 * (up through 2K+) and stays pixel-true at the 1512 design width. The stage is
 * left-aligned full-bleed so the dotted spine always starts flush at the left
 * viewport edge. The SVG spine scales via its viewBox; dots share that grid.
 *
 * FROST convention: the glass pills / badge / calendar use the site's inset-white
 * veil (shadow-[inset…]) in place of the Figma backdrop-blur (see
 * docs/backdrop-filter-sweep.md), matching the FAQ pills.
 *
 * ICONS are exported 1:1 from Figma (timeline-icons.tsx): the day-12 refresh, the
 * day-5 delivery check, the banked-day pause glyphs.
 *
 * PHASE 1 — static, finished state (path fully drawn, all beats shown, day-12
 * chip resting on its refresh icon). The reveal hooks (data-tl-*) are present but
 * inert; the on-enter master timeline + micro-animations land in later phases.
 */

export default function Timeline() {
  return (
    <section
      data-timeline
      className="relative w-full overflow-hidden py-[10dvh] max-md:py-[8dvh]"
    >
      {/* Full-bleed: the stage spans the viewport so the dotted spine runs from
          the left edge; `cqw` sizing scales the whole composition with the
          viewport width rather than capping at the 1512 design size. */}
      <div className="@container w-full">
        <div className="relative aspect-[1512/982] w-full">
          {/* ── The dotted spine + its dots (one shared 1512×982 grid). ── */}
          <svg
            viewBox="0 0 1512 982"
            fill="none"
            preserveAspectRatio="xMidYMid meet"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden
          >
            <g transform={PATH_TRANSFORM}>
              <path
                data-tl-path
                d={PATH_D}
                stroke="white"
                strokeOpacity="0.85"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="6 6"
              />
            </g>
            {DOTS.map((d, i) => (
              <circle
                key={i}
                data-tl-dot
                data-beat={d.beat}
                cx={d.cx}
                cy={d.cy}
                r={d.r}
                fill="white"
              />
            ))}
          </svg>

          {/* ── Header (746:4543). ── */}
          <div className="absolute left-[5.03%] top-[4.07%] flex w-[28.77cqw] flex-col gap-[0.99cqw] text-white">
            <h2
              data-timeline-head
              className="text-[3.241cqw] leading-[1.1] tracking-[-0.03em]"
            >
              <span className="font-light">{HEADING.lead}</span>
              <span className="font-instrument">{HEADING.accent}</span>
            </h2>
            <p data-timeline-sub className="text-[1.058cqw] tracking-[0.02em]">
              {HEADING.sub}
            </p>
          </div>

          {/* ── "and up we go" + the ascend mark, top-right (746:4536 / 746:4538). ── */}
          <p className="absolute left-[91.8%] top-[1.02%] w-[5.6cqw] text-[0.926cqw] leading-[1.2] text-white/90">
            {AND_UP_WE_GO}
          </p>
          {/* The block mark IS the pen — in Phase 2 it rides the spine drawing
              the line, so at rest its bottom-left foot must sit exactly on the
              line's terminus (frame ≈1398.5,71). Positioned so the foot lands
              there rather than at the mark's Figma box origin (746:4538). */}
          <AscndMark className="absolute left-[91.8%] top-[4.27%] w-[2.595cqw] text-white" />

          {/* ── day 1 — "you subscribe" (746:4160). ── */}
          <div
            data-tl-beat="subscribe"
            className="absolute left-[11.64%] top-[50.41%] flex w-[15.54cqw] flex-col gap-[0.794cqw]"
          >
            {/* "creating your board" — the CTA pill (matches the site button)
                wearing the always-on rainbow aura, the ring the aura itself
                originated from. Rendered in cqw (not the fixed-px <Button>) so it
                scales crisply with the composition on 2K+ screens. */}
            <div className="relative flex w-full items-center justify-center rounded-[2.116cqw] bg-gradient-to-b from-white to-[#efefef] px-[1.323cqw] py-[0.463cqw] shadow-[inset_0px_-2px_1px_0px_#f2f2f2,inset_0px_-2px_2px_0px_rgba(0,0,0,0.5)]">
              <TimelineAura
                radius="2.116cqw"
                ring="0.2cqw"
                spread="0.44cqw"
                blur="0.62cqw"
              />
              <span className="relative text-[1.058cqw] text-[#263138]">
                creating your board
              </span>
            </div>
            <CardText k="subscribe" />
          </div>

          {/* ── day 2 — "first request in progress" (746:4145). ── */}
          <div
            data-tl-beat="first-request"
            className="absolute left-[29.63%] top-[75.05%] flex w-[17.92cqw] flex-col gap-[0.529cqw]"
          >
            <CardText k="first-request" />
            <div className="flex flex-col gap-[0.331cqw]">
              <TaskPill label="landing page refresh">
                <Chip>UI/UX</Chip>
              </TaskPill>
              <TaskPill label="request anything">
                <Chip>70% completed</Chip>
              </TaskPill>
            </div>
          </div>

          {/* ── day 5 — "first delivery lands" (746:4168). ── */}
          <div
            data-tl-beat="delivery"
            className="absolute left-[37.3%] top-[20.16%] flex w-[13.96cqw] flex-col gap-[0.7cqw]"
          >
            <div className="relative aspect-[192/141] w-[12.7cqw]">
              <Image
                src="/timeline/day5-delivery.png"
                alt="the first delivered design, landed straight on your board"
                fill
                sizes="13vw"
                className="rounded-[0.9cqw] object-cover"
              />
              {/* ✓ delivery badge — frost-glass circle + two-tone check (746:4419). */}
              <span className="absolute -right-[0.4cqw] -top-[0.4cqw] flex size-[1.19cqw] items-center justify-center rounded-full border-[0.03cqw] border-white/50 bg-gradient-to-b from-black/10 to-black/5 text-white shadow-[inset_0_0_0_999px_rgba(255,255,255,0.12)]">
                <Check className="size-[0.85cqw]" />
              </span>
            </div>
            <CardText k="delivery" />
          </div>

          {/* ── Floating "Designs in review" label on the curve (746:4425). ── */}
          <p className="absolute left-[58.73%] top-[16.09%] w-[4.7cqw] text-[1.058cqw] leading-[1.2] text-white/90">
            {DESIGNS_IN_REVIEW}
          </p>

          {/* ── day 12 — "revised until right" (746:4427). ── */}
          <div
            data-tl-beat="revised"
            className="absolute left-[57.14%] top-[43.89%] flex w-[11.11cqw] flex-col gap-[0.397cqw]"
          >
            <CardText k="revised" />
            <TaskPill label="landing page refresh" padLeft="0.761cqw">
              {/* In-review refresh chip (Phase 3: spins → tick + aura). */}
              <span
                data-tl-refresh
                className="flex size-[1.588cqw] items-center justify-center rounded-full border-[0.079cqw] border-[#ffe8b7] bg-white text-[#737373]"
              >
                <Refresh className="size-[1.058cqw]" />
              </span>
            </TaskPill>
          </div>

          {/* ── day 23 — "queue empty? pause." + banked-days grid (746:4439). ── */}
          <div
            data-tl-beat="pause"
            className="absolute left-[77.98%] top-[58.25%] flex w-[11.24cqw] flex-col gap-[0.86cqw]"
          >
            <CardText k="pause" />
            <BankedCalendar />
          </div>
        </div>
      </div>
    </section>
  );
}

/** The day-label / title / body stack shared by every beat's card. */
function CardText({ k }: { k: Parameters<typeof beat>[0] }) {
  const b = beat(k);
  return (
    <div className="flex flex-col gap-[0.463cqw]">
      <p className="text-[0.794cqw] text-white/55">{b.day}</p>
      <p className="text-[1.058cqw] tracking-[0.02em] text-white">{b.title}</p>
      <p className="text-[0.794cqw] font-light leading-normal text-white/85">
        {b.body}
      </p>
    </div>
  );
}

/** A glass task row — label on the left, a chip / status on the right. Not
 *  clipped (overflow-visible) so a chip's aura can bloom past the pill edge. */
function TaskPill({
  label,
  padLeft = "1.158cqw",
  children,
}: {
  label: string;
  padLeft?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex h-[2.116cqw] w-full items-center rounded-[4.101cqw] border-[0.033cqw] border-white/60 bg-gradient-to-b from-black/10 to-black/5 shadow-[inset_0_0_0_999px_rgba(255,255,255,0.06)]">
      <span
        className="text-[0.728cqw] text-white"
        style={{ paddingLeft: padLeft }}
      >
        {label}
      </span>
      <span className="absolute right-[0.221cqw] top-1/2 -translate-y-1/2">
        {children}
      </span>
    </div>
  );
}

/** White status chip (category tag / progress note) wearing the rainbow aura. */
function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="relative flex items-center justify-center rounded-[2.05cqw] bg-white px-[0.633cqw] py-[0.317cqw] text-[0.661cqw] leading-[1.5] text-[#263138]">
      <TimelineAura radius="2.05cqw" ring="0.11cqw" spread="0.26cqw" blur="0.36cqw" />
      <span className="relative">{children}</span>
    </span>
  );
}

/** The "11 days banked" calendar (746:4444) — a 7-wide grid of day cells. */
function BankedCalendar() {
  return (
    <div className="flex w-full flex-col items-center gap-[0.463cqw] overflow-hidden rounded-[0.7cqw] border-[0.048cqw] border-white/60 bg-gradient-to-b from-black/10 to-black/5 px-[0.7cqw] py-[0.661cqw] shadow-[inset_0_0_0_999px_rgba(255,255,255,0.06)]">
      <div className="flex items-center gap-[0.3cqw] text-white">
        <span className="text-[0.661cqw]">{BANKED_LABEL}</span>
        <Check className="size-[0.926cqw]" />
      </div>
      {/* The grid carries the design's faint blur — a soft "stack of days". */}
      <div
        data-tl-grid
        className="flex flex-col items-center gap-[0.322cqw] [filter:blur(0.1cqw)]"
      >
        {BANKED_GRID.map((row, r) => (
          <div key={r} className="flex gap-[0.322cqw]">
            {row.map((cell, c) => (
              <DayCell key={c} state={cell} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCell({ state }: { state: Cell }) {
  return (
    <div
      className={`flex size-[1.129cqw] items-center justify-center rounded-full ${
        state === "solid" ? "bg-white" : state === "muted" ? "bg-white/35" : "bg-white/30"
      }`}
    >
      {state === "pause" && <Pause className="size-[0.85cqw] text-white/60" />}
    </div>
  );
}

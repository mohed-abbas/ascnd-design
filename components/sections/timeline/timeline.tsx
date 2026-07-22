import Image from "next/image";
import type { ReactNode } from "react";
import Logo from "@/components/ui/logo";
import { Check, Spinner } from "./timeline-icons";
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
 * "your first month, plotted" — Figma frame 746:4125.
 *
 * A full-bleed "journey" timeline: a winding dotted spine threads five milestone
 * beats (day 1 → day 23) plus a floating "Designs in review" label, ending
 * top-right at the ascnd mark ("and up we go"). Sits between <PlanCompare/> and
 * <BookACall/> on /pricing and, like every section, renders TRANSPARENT over the
 * shared sky (the mock's own #62abff + grain are intentionally not reproduced).
 *
 * SCALING: the whole 1512×943 composition is one scalable "stage" — a
 * `@container` wrapper caps it at 1512px, and every size is expressed in `cqw`
 * (1cqw = 1% of the stage width) with positions in `%`, so the artwork scales as
 * a single unit on any desktop width and stays pixel-true at the design size.
 * The SVG spine scales via its viewBox; the dots (frame coords) share that grid.
 *
 * FROST convention: the glass pills / calendar use the site's inset-white veil
 * (shadow-[inset…]) in place of the Figma backdrop-blur (see
 * docs/backdrop-filter-sweep.md), matching the FAQ pills.
 *
 * PHASE 1 — static, finished state (path fully drawn, all beats shown, day-12
 * chip resting on its spinner). The reveal hooks (data-tl-*) are present but
 * inert; the on-enter master timeline + micro-animations land in later phases.
 */

// px → cqw for this 1512-wide frame (1px = 100/1512 %). Sizes below are the
// Figma px, converted; positions are the card's frame x/y as a % of 1512×943.

export default function Timeline() {
  return (
    <section
      data-timeline
      className="relative w-full overflow-hidden py-[10dvh] max-md:py-[8dvh]"
    >
      {/* Full-bleed: the stage spans the viewport so the dotted spine runs
          edge-to-edge (enters at the left edge, exits top-right) with no gutter.
          `cqw` sizing means the whole composition scales with the viewport width
          rather than capping at the 1512 design size. */}
      <div className="@container w-full">
        <div className="relative aspect-[1512/943] w-full">
          {/* ── The dotted spine + its dots (one shared 1512×943 grid). ── */}
          <svg
            viewBox="0 0 1512 943"
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
          <div className="absolute left-[5.03%] top-[4.24%] flex w-[28.77cqw] flex-col gap-[0.99cqw] text-white">
            <h2
              data-timeline-head
              className="text-[3.241cqw] leading-[1.1] tracking-[-0.03em]"
            >
              <span className="font-light">{HEADING.lead}</span>
              <span className="font-instrument">{HEADING.accent}</span>
            </h2>
            <p
              data-timeline-sub
              className="text-[1.058cqw] tracking-[0.02em]"
            >
              {HEADING.sub}
            </p>
          </div>

          {/* ── "and up we go" + the ascend mark, top-right (746:4536 / 746:4538). ── */}
          <p className="absolute left-[91.8%] top-[1.06%] w-[5.6cqw] text-[0.926cqw] leading-[1.2] text-white/90">
            {AND_UP_WE_GO}
          </p>
          <Logo className="absolute left-[92.6%] top-[4.24%] w-[2.58cqw] text-white" />

          {/* ── day 1 — "you subscribe" (746:4160). ── */}
          <div
            data-tl-beat="subscribe"
            className="absolute left-[11.64%] top-[52.49%] flex w-[15.54cqw] flex-col gap-[0.794cqw]"
          >
            {/* "creating your board" — the solid-CTA shape ringed in amber
                (#ffe8b7), the static ancestor of the button's rainbow aura. */}
            <div className="relative flex w-full items-center justify-center rounded-[2.116cqw] border-[0.198cqw] border-[#ffe8b7] bg-gradient-to-b from-white to-[#efefef] px-[1.323cqw] py-[0.463cqw] shadow-[inset_0px_-2px_1px_0px_#f2f2f2,inset_0px_-2px_2px_0px_rgba(0,0,0,0.5)]">
              <span className="text-[1.058cqw] text-[#263138]">
                creating your board
              </span>
            </div>
            <CardText k="subscribe" />
          </div>

          {/* ── day 2 — "first request in progress" (746:4145). ── */}
          <div
            data-tl-beat="first-request"
            className="absolute left-[29.63%] top-[78.15%] flex w-[17.92cqw] flex-col gap-[0.529cqw]"
          >
            <CardText k="first-request" />
            <div className="flex flex-col gap-[0.331cqw]">
              <TaskPill label="landing page refresh">
                <Chip borderColor="#ffe8b7">UI/UX</Chip>
              </TaskPill>
              <TaskPill label="request anything">
                <Chip borderColor="#ffba24">70% completed</Chip>
              </TaskPill>
            </div>
          </div>

          {/* ── day 5 — "first delivery lands" (746:4168). ── */}
          <div
            data-tl-beat="delivery"
            className="absolute left-[37.3%] top-[21%] flex w-[13.96cqw] flex-col gap-[0.7cqw]"
          >
            <div className="relative aspect-[192/141] w-[12.7cqw]">
              <Image
                src="/timeline/day5-delivery.png"
                alt="the first delivered design, landed straight on your board"
                fill
                sizes="13vw"
                className="rounded-[0.9cqw] object-cover"
              />
              {/* ✓ delivery badge, top-right of the shot (746:4419). */}
              <span className="absolute -right-[0.4cqw] -top-[0.4cqw] flex size-[1.19cqw] items-center justify-center rounded-full bg-white text-[#3aa76d] shadow-sm">
                <Check className="size-[0.8cqw]" />
              </span>
            </div>
            <CardText k="delivery" />
          </div>

          {/* ── Floating "Designs in review" label on the curve (746:4425). ── */}
          <p className="absolute left-[58.73%] top-[16.76%] w-[4.7cqw] text-[1.058cqw] leading-[1.2] text-white/90">
            {DESIGNS_IN_REVIEW}
          </p>

          {/* ── day 12 — "revised until right" (746:4427). ── */}
          <div
            data-tl-beat="revised"
            className="absolute left-[57.14%] top-[45.7%] flex w-[11.11cqw] flex-col gap-[0.397cqw]"
          >
            <CardText k="revised" />
            <TaskPill label="landing page refresh" padLeft="0.761cqw">
              {/* The in-review spinner (Phase 3: spins → tick + aura). */}
              <span
                data-tl-spinner
                className="flex size-[1.588cqw] items-center justify-center rounded-full border-[0.079cqw] border-[#ffe8b7] bg-white text-[#263138]"
              >
                <Spinner className="size-[1.058cqw]" />
              </span>
            </TaskPill>
          </div>

          {/* ── day 23 — "queue empty? pause." + banked-days grid (746:4439). ── */}
          <div
            data-tl-beat="pause"
            className="absolute left-[77.98%] top-[60.66%] flex w-[11.24cqw] flex-col gap-[0.86cqw]"
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

/** A glass task row — label on the left, a chip / status on the right. */
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
    <div className="relative flex h-[2.116cqw] w-full items-center overflow-hidden rounded-[4.101cqw] border-[0.033cqw] border-white/60 bg-gradient-to-b from-black/10 to-black/5 shadow-[inset_0_0_0_999px_rgba(255,255,255,0.06)]">
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

/** White status chip with a warm ring (category tag / progress note). */
function Chip({
  borderColor,
  children,
}: {
  borderColor: string;
  children: ReactNode;
}) {
  return (
    <span
      className="flex items-center justify-center rounded-[2.05cqw] border-[0.079cqw] bg-white px-[0.633cqw] py-[0.317cqw] text-[0.661cqw] leading-[1.5] text-[#263138]"
      style={{ borderColor }}
    >
      {children}
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
        state === "muted" ? "bg-white/35" : "bg-white"
      }`}
    >
      {state === "check" && <Check className="size-[0.8cqw] text-[#62abff]" />}
    </div>
  );
}

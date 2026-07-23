import Image from "next/image";
import type { ReactNode } from "react";
import TimelineAura from "./timeline-aura";
import TimelineReveal from "./timeline-reveal";
import { AscndMark, Check, Pause, Refresh, Spinner } from "./timeline-icons";
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
 * ANIMATION is on-enter, one-shot, eased (ScrollTrigger fires once; no scrub).
 * <TimelineReveal/> (client, renders null) drives it off the data-tl-* hooks:
 *   • PHASE 2 (this pass) — heading blur-rise, then the spine draws on via a
 *     mask sweep (data-tl-mask) with the ascnd mark (data-tl-pen) riding the
 *     draw-head as the "pen", and each dot (data-tl-dot) popping as the head
 *     reaches it. The endnote ("and up we go") fades in as the pen lands.
 *   • PHASE 3 (next) — per-beat card reveals + in-card micro-animations
 *     (day-12 refresh spin→tick+aura, 70% count-up, calendar fill, …). The
 *     cards render in their finished state here; they're untouched by Phase 2.
 *
 * Reduced motion / no-JS: every element renders in its finished state (spine
 * fully drawn, dots full-size, heading shown), and TimelineReveal early-returns,
 * so the static composition is the graceful fallback.
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
        <div data-tl-stage className="relative aspect-[1512/982] w-full">
          {/* ── The dotted spine + its dots (one shared 1512×982 grid). ── */}
          <svg
            viewBox="0 0 1512 982"
            fill="none"
            preserveAspectRatio="xMidYMid meet"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden
          >
            {/* Draw-on mask: a fat solid brush of the same centreline. pathLength=1
                + dasharray "1 1" normalise the wipe to a simple strokeDashoffset
                1→0 draw — the exact mechanism the home pricing connector uses
                (pricing-icons.tsx). Default offset 0 = fully drawn (SSR /
                reduced-motion show the whole spine).

                The mask is applied to the PATH (inside the translate group), and
                the brush here is TRANSFORM-FREE: a mask referenced by an element
                is evaluated in that element's own user space, which for the
                visible path is the group's post-translate local space — the same
                space PATH_D is authored in. So brush `d` and visible `d` line up
                with no transform. (Wrapping the brush in the translate too — or
                masking the <g> — double-shifts it and only fragments show.) The
                region is huge so the mask never clips regardless of that space. */}
            <defs>
              <mask
                id="tl-reveal"
                maskUnits="userSpaceOnUse"
                x="-2000"
                y="-2000"
                width="4000"
                height="4000"
              >
                <path
                  data-tl-mask
                  d={PATH_D}
                  stroke="white"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeDashoffset={0}
                />
              </mask>
            </defs>
            <g transform={PATH_TRANSFORM}>
              <path
                data-tl-path
                d={PATH_D}
                mask="url(#tl-reveal)"
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
                // Revealed by a pure opacity fade as the draw-head passes (no
                // scale/transform), so the dot stays put on the spine.
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
          <p
            data-tl-endnote
            className="absolute left-[91.8%] top-[1.02%] w-[5.6cqw] text-[0.926cqw] leading-[1.2] text-white/90"
          >
            {AND_UP_WE_GO}
          </p>
          {/* The block mark IS the pen — in Phase 2 it rides the spine drawing
              the line, so at rest its bottom-left foot must sit exactly on the
              line's terminus (frame ≈1398.5,71). Positioned so the foot lands
              there rather than at the mark's Figma box origin (746:4538).
              TimelineReveal self-calibrates the travel off this resting spot, so
              p=1 lands the foot back here exactly. */}
          <AscndMark
            data-tl-pen
            className="absolute left-[91.8%] top-[4.27%] w-[2.595cqw] text-white"
          />

          {/* ── day 1 — "you subscribe" (746:4160). ── */}
          <div
            data-tl-beat="subscribe"
            className="absolute left-[11.64%] top-[50.41%] flex w-[15.54cqw] flex-col gap-[0.794cqw]"
          >
            {/* "creating your board" — the site CTA button, 1:1 with the real
                <Button> solid variant (rounded-32 / px-20 / py-7 / text-16, all in
                cqw so it scales with the stage on 2K+), content-sized like the
                real button (self-start, not stretched) and wearing the always-on
                rainbow aura — no hover/cursor gating.

                On reveal it plays a loading→done state: a dotted spinner spins
                while "creating your board", then cross-fades to a ✓ + "board
                created". The (wider) loading row reserves the width so the swap
                doesn't jump; the done row is the resolved SSR / reduced-motion
                state. */}
            <div
              data-tl-board
              className="relative inline-flex items-center justify-center self-start rounded-[2.116cqw] bg-gradient-to-b from-white to-[#efefef] px-[1.323cqw] py-[0.463cqw] text-[1.058cqw] text-[#263138] shadow-[inset_0px_-2px_1px_0px_#f2f2f2,inset_0px_-2px_2px_0px_rgba(0,0,0,0.5)]"
            >
              <TimelineAura
                radius="2.116cqw"
                ring="0.2cqw"
                spread="0.44cqw"
                blur="0.62cqw"
              />
              {/* Two stacked rows; the text change rolls PER-CHARACTER (RollingText:
                  each letter clips + rolls up, staggered) — the same roll the
                  subscribe card uses (cards/subscribe-media.tsx). The wrapper is
                  NOT clipped: the per-letter clips do the masking, so the aura
                  still blooms outside. */}
              <span className="relative flex">
                {/* loading — in-flow, reserves the (wider) width */}
                <span
                  data-tl-board-loading
                  className="pointer-events-none flex items-center gap-[0.5cqw] leading-[1.2] opacity-0"
                >
                  <Spinner data-tl-board-spinner className="size-[1.058cqw] shrink-0" />
                  <span className="inline-block">
                    <RollingText text="creating your board" />
                  </span>
                </span>
                {/* done — absolute overlay; resting default (SSR / reduced-motion) */}
                <span
                  data-tl-board-done
                  className="pointer-events-none absolute inset-0 flex items-center justify-center gap-[0.4cqw] leading-[1.2]"
                >
                  <Check
                    data-tl-board-check
                    className="size-[1.058cqw] shrink-0 text-[#34c759]"
                  />
                  <span className="inline-block">
                    <RollingText text="board created" />
                  </span>
                </span>
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
                <ProgressChip />
              </TaskPill>
              <TaskPill label="request anything">
                <Chip aura={false}>Brand</Chip>
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
              {/* ✓ delivery badge — frost-glass circle + two-tone check (746:4419).
                  Stamps onto the design once this day reveals. */}
              <span
                data-tl-stamp
                className="absolute -right-[0.4cqw] -top-[0.4cqw] flex size-[1.19cqw] items-center justify-center rounded-full border-[0.03cqw] border-white/50 bg-gradient-to-b from-black/10 to-black/5 text-white shadow-[inset_0_0_0_999px_rgba(255,255,255,0.12)]"
              >
                <Check className="size-[0.85cqw]" />
              </span>
            </div>
            <CardText k="delivery" />
          </div>

          {/* ── Floating "Designs in review" label on the curve (746:4425). ── */}
          <p
            data-tl-float
            className="absolute left-[58.73%] top-[16.09%] w-[4.7cqw] text-[1.058cqw] leading-[1.2] text-white/90"
          >
            {DESIGNS_IN_REVIEW}
          </p>

          {/* ── day 12 — "revised until right" (746:4427). ── */}
          <div
            data-tl-beat="revised"
            className="absolute left-[57.14%] top-[43.89%] flex w-[11.11cqw] flex-col gap-[0.397cqw]"
          >
            <CardText k="revised" />
            <TaskPill label="landing page refresh" padLeft="0.761cqw">
              {/* In-review chip: the refresh spins while "in progress", then
                  cross-fades to a green tick as the rainbow aura ignites — the
                  work landing "done". SSR / reduced-motion rest on the refresh
                  (the static in-review state); the tick + aura start hidden. */}
              <span
                data-tl-refresh
                className="relative grid size-[1.588cqw] place-items-center rounded-full border-[0.079cqw] border-[#ffe8b7] bg-white text-[#737373]"
              >
                <span
                  data-tl-refresh-aura
                  className="pointer-events-none absolute inset-0 opacity-0"
                >
                  <TimelineAura
                    radius="9999px"
                    ring="0.11cqw"
                    spread="0.24cqw"
                    blur="0.34cqw"
                  />
                </span>
                <Refresh
                  data-tl-refresh-spin
                  className="col-start-1 row-start-1 size-[1.058cqw]"
                />
                <Check
                  data-tl-refresh-check
                  className="col-start-1 row-start-1 size-[1.058cqw] text-[#34c759] opacity-0"
                />
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

          {/* On-enter, one-shot spine draw + dot pops + pen travel (renders null). */}
          <TimelineReveal />
        </div>
      </div>
    </section>
  );
}

/**
 * Per-character roll-up unit (mirrors the subscribe card, cards/subscribe-media.tsx):
 * each letter sits in an overflow-clipped wrapper with a `[data-char]` mover that
 * TimelineReveal slides up (yPercent 110→0, staggered). Spaces render as an inert
 * spacer so word gaps survive the split; SSR renders the letters in place.
 */
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

/**
 * White status chip (category tag / progress note). Wears the rainbow aura by
 * default; pass `aura={false}` for a plain white chip (the day-2 "Brand" tag).
 */
function Chip({ children, aura = true }: { children: ReactNode; aura?: boolean }) {
  return (
    <span className="relative flex items-center justify-center rounded-[2.05cqw] bg-white px-[0.633cqw] py-[0.317cqw] text-[0.661cqw] leading-[1.5] text-[#263138]">
      {aura && (
        <TimelineAura radius="2.05cqw" ring="0.11cqw" spread="0.26cqw" blur="0.36cqw" />
      )}
      <span className="relative">{children}</span>
    </span>
  );
}

/**
 * The day-2 "landing page refresh" progress chip. Wears the rainbow aura and
 * loops forever: the "UI/UX" category tag rolls PER-CHARACTER to "35% completed"
 * two seconds in, then back — the same roll the board button / subscribe card
 * use (TimelineReveal drives it, IntersectionObserver idles it off-screen). The
 * wider "35% completed" row is in-flow and reserves the width so the swap never
 * jumps; the "UI/UX" row overlays it and is the resting SSR / reduced-motion state.
 */
function ProgressChip() {
  return (
    <span className="relative flex items-center justify-center rounded-[2.05cqw] bg-white px-[0.633cqw] py-[0.317cqw] text-[0.661cqw] leading-[1.5] text-[#263138]">
      <TimelineAura radius="2.05cqw" ring="0.11cqw" spread="0.26cqw" blur="0.36cqw" />
      {/* The box width animates to fit whichever label shows: TimelineReveal
          measures both rows' natural widths (in cqw, so it stays responsive) and
          tweens the box between them as the text rolls. The label row is in-flow
          — it gives the box its height and its SSR / reduced-motion width; the
          progress row overlays it. The per-letter clips do the masking, so the
          aura still blooms outside. */}
      <span data-tl-prog-box className="relative block">
        {/* progress — absolute overlay, hidden until it rolls in */}
        <span
          data-tl-prog-full
          className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0"
        >
          <span data-tl-prog-full-inner className="whitespace-nowrap">
            <RollingText text="35% completed" />
          </span>
        </span>
        {/* label — in-flow; resting default (SSR / reduced-motion) */}
        <span
          data-tl-prog-label
          className="pointer-events-none flex items-center justify-center"
        >
          <span data-tl-prog-label-inner className="whitespace-nowrap">
            <RollingText text="UI/UX" />
          </span>
        </span>
      </span>
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
      data-tl-cell
      className={`flex size-[1.129cqw] items-center justify-center rounded-full ${
        state === "solid" ? "bg-white" : state === "muted" ? "bg-white/35" : "bg-white/30"
      }`}
    >
      {state === "pause" && <Pause className="size-[0.85cqw] text-white/60" />}
    </div>
  );
}

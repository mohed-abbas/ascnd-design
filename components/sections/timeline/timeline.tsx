import Image from "next/image";
import type { ReactNode } from "react";
import TimelineAura from "./timeline-aura";
import TimelineMicroMount from "./timeline-micro-mount";
import TimelineReveal from "./timeline-reveal";
import { AscndMark, Check, Pause, Refresh, Spinner } from "./timeline-icons";
import {
  AND_UP_WE_GO,
  BANKED_GRID,
  BANKED_LABEL,
  beat,
  BEATS,
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
 * (up through 2K+) and stays pixel-true at the 1512 design width. The wrapper's
 * width is CAPPED at 153.97dvh (= 100dvh × 1512/982) so the aspect-locked stage
 * always fits a single viewport's height — no clipping while pinned — and it is
 * left-anchored, so when the cap bites the spare width sits on the right and the
 * dotted spine still starts flush at the left viewport edge. The SVG spine
 * scales via its viewBox; dots share that grid.
 *
 * FROST convention: the glass pills / badge / calendar use the site's inset-white
 * veil (shadow-[inset…]) in place of the Figma backdrop-blur (see
 * docs/backdrop-filter-sweep.md), matching the FAQ pills.
 *
 * ICONS are exported 1:1 from Figma (timeline-icons.tsx): the day-12 refresh, the
 * day-5 delivery check, the banked-day pause glyphs.
 *
 * ANIMATION is BOUND TO SCROLL: the master reveal (heading blur-rise, the
 * spine drawing on via the mask sweep with the ascnd mark riding the head as
 * the "pen", dots + cards revealing as the head passes, the endnote settling)
 * is SCRUBBED — scroll down draws, scroll up un-draws. Two team-A/B modes,
 * switched with ?tl= (see timeline-reveal.tsx): ?tl=pin (DEFAULT — the
 * section pins and ~2 viewport-heights of scroll drive the draw) or ?tl=scrub
 * (unpinned — the draw advances as the stage travels the viewport). The in-card
 * micro-LOOPS (board button, progress chip, refresh tick, bank fill) stay
 * time-based infinite loops, idled off-screen by IntersectionObservers.
 *
 * Reduced motion / no-JS: every element renders in its finished state (spine
 * fully drawn, dots full-size, heading shown), and TimelineReveal early-returns,
 * so the static composition is the graceful fallback.
 */

export default function Timeline() {
  return (
    <section
      data-timeline
      // Shared section rhythm (--gap-section, globals.css — see comparison.tsx).
      // It MUST stay symmetric: the pin starts at "center center"
      // (timeline-reveal.tsx PIN_START), so the padding has to hang evenly off
      // both edges of the height-capped stage or the composition pins off-centre.
      className="relative w-full overflow-hidden py-section"
    >
      {/* FIT-TO-VIEWPORT: the stage's width is capped so its aspect-locked
          height never exceeds the viewport height — 100dvh × 1512/982 ≈
          153.97dvh — so the whole composition is visible in a single viewport
          while pinned (no top/bottom clipping on 16:9). On viewports taller
          than the design ratio (portrait/mobile) the cap is inert and the
          stage spans the full width as before. `cqw` sizing keys off this
          @container wrapper, so the entire artwork rescales as one unit.

          CENTERED (mx-auto): when the cap bites, the spare width splits evenly
          left/right so the composition sits balanced. The spine still
          ORIGINATES at the viewport's left margin: TimelineReveal prepends a
          straight lead-in segment along the path's start tangent, long enough
          to cross the left gutter (the path's own start already bleeds 43
          frame-px off the stage edge). SSR / no-JS / reduced-motion show the
          un-extended path. */}
      <div className="@container mx-auto hidden w-[min(100%,153.97dvh)] md:block">
        {/* --tl-u is the TYPE unit, and the one knob for how big the words are.
            1cqw is the artwork's own unit (1% of stage width, 15.12px at the
            1512 design width), so type authored in it scales perfectly with the
            drawing — but the FIT-TO-VIEWPORT cap above means a real laptop never
            gets the design width: a 1512×982 screen leaves the browser ~860px of
            viewport height once its chrome is off, the stage caps to ~1324, and
            every size lands 12% under the Figma value. Body copy rendered at
            10.5px and the task-pill / calendar labels at 9.6 / 8.8px.

            So type is authored as `calc(<figma factor> * var(--tl-u))` instead,
            and the unit is clamped on BOTH sides:
              lower  1cqw       — never smaller than the artwork's own scale, so
                                  type still grows with the stage on 2K+.
              value  18px       — the size the words actually want to be. The
                                  Figma unit is 15.12px (body 12 / pill 11 /
                                  chip 10), which read too small on a laptop even
                                  once restored, so this runs the whole type
                                  scale 19% hot: body 14.3, pill 13.1, chip 11.9.
                                  Raise it to make the words bigger — but see the
                                  clearance note below, 20px is where it clips.
              upper  1.36cqw    — type may never run more than 36% ahead of the
                                  artwork. Geometry (beat positions, card widths,
                                  the spine, the calendar grid) stays on raw cqw,
                                  so every % the type gains on it is a % of extra
                                  wrapping inside a box that didn't grow, and the
                                  day-2 card grows DOWNWARD into the stage's
                                  bottom edge. 1.36 is the ratio 18px asks for at
                                  the ~1324 laptop stage; measured there it still
                                  clears the bottom by 16px, and because the
                                  ceiling holds the ratio constant on anything
                                  shorter, that clearance only scales — it never
                                  inverts. Without a ceiling a phone would ask
                                  for 3.9 and every beat would collide.

            Below md this stage is NOT RENDERED AT ALL (max-md:hidden on the
            wrapper above) — see <TimelineMobile/> below. The winding 1512×982
            composition at 390px was a 0.258 miniature: measured, body copy came
            out at 4.1px and the endnote at 3.6px. No type floor can fix that,
            because the geometry it has to fit inside shrank with it.

            --tl-g is the GEOMETRY unit, the counterpart to --tl-u. Widget
            internals (pill radii, hairlines, calendar cells, grid gaps) were
            authored in raw `cqw`; they are now `calc(<figma factor> *
            var(--tl-g))`, and here --tl-g IS 1cqw — so `calc(4.101*var(--tl-g))`
            is exactly the `4.101cqw` it replaced and desktop output is
            unchanged, identically, at every width. The indirection exists so the
            mobile layout can reuse the very same widget components with --tl-g
            pinned to 15.12px (the design's own 1cqw at the 1512 frame), which
            renders each widget at its true Figma pixel size instead of at a
            fraction of a phone's width.

            The heading is the one size that stays on raw cqw (see below). */}
        <div
          data-tl-stage
          className="relative aspect-[1512/982] w-full [--tl-g:1cqw] [--tl-u:1cqw] md:[--tl-u:clamp(1cqw,18px,1.36cqw)]"
        >
          {/* ── The dotted spine + its dots (one shared 1512×982 grid). ── */}
          {/* overflow-visible: the lead-in extension renders LEFT of the
              viewBox (negative x); the section's own overflow-hidden clips it
              cleanly at the viewport edge. */}
          <svg
            viewBox="0 0 1512 982"
            fill="none"
            preserveAspectRatio="xMidYMid meet"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
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
                stroke="white"
                strokeWidth="1.5"
                // Two-state checkpoint: TimelineReveal parks it as a hollow
                // RING (fill-opacity 0) that soft-fades in as the section
                // enters, then the fill sweeps in as the draw-head passes —
                // no scale/transform, the dot stays put on the spine. This
                // resting markup (ring + fill both solid) is the finished
                // state for SSR / no-JS / reduced-motion.
              />
            ))}
          </svg>

          {/* ── Header (746:4543). ── */}
          <div className="absolute left-[5.03%] top-[4.07%] flex w-[28.77cqw] flex-col gap-[0.99cqw] text-white">
            {/* The heading stays on raw cqw — the ONE size that doesn't take the
                floor. At 49px it's already far past any legibility floor, and it
                is set to fill its 28.77cqw block on one line: holding it at the
                design px while the block shrinks with the artwork would wrap it
                to two lines and push the subhead into the spine. It scales with
                the drawing; everything under it holds its size. */}
            <h2
              data-timeline-head
              className="text-[3.241cqw] leading-[1.1] tracking-[-0.03em]"
            >
              <span className="font-light">{HEADING.lead}</span>
              <span className="font-instrument">{HEADING.accent}</span>
            </h2>
            <p
              data-timeline-sub
              className="text-[calc(1.058*var(--tl-u))] tracking-[0.02em]"
            >
              {HEADING.sub}
            </p>
          </div>

          {/* ── "and up we go" + the ascend mark, top-right (746:4536 / 746:4538). ── */}
          <p
            data-tl-endnote
            // Width rides the TYPE unit, not raw cqw: this box exists only to
            // wrap its own words ("and up we go" over two lines), so holding it
            // at the artwork's scale while the type runs ahead shreds it into
            // one word per line. Same for the floating label and the board
            // button below — every OTHER box stays on cqw.
            className="absolute left-[91.8%] top-[1.02%] w-[calc(5.6*var(--tl-u))] text-[calc(0.926*var(--tl-u))] leading-[1.2] text-white/90"
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
              // whitespace-nowrap: it's a BUTTON label, it never breaks. Its
              // beat wrapper is a cqw width, so at a hot type unit the words
              // would otherwise wrap mid-word ("creating your b / oard"); the
              // button is self-start, so overflowing that invisible box costs
              // nothing (the day-5 card is ~130px clear to its right).
              className="relative inline-flex items-center justify-center self-start whitespace-nowrap rounded-[2.116cqw] bg-gradient-to-b from-white to-[#efefef] px-[calc(1.323*var(--tl-u))] py-[calc(0.463*var(--tl-u))] text-[calc(1.058*var(--tl-u))] text-[#263138] shadow-[inset_0px_-2px_1px_0px_#f2f2f2,inset_0px_-2px_2px_0px_rgba(0,0,0,0.5)]"
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
                  className="pointer-events-none flex items-center gap-[calc(0.5*var(--tl-u))] leading-[1.2] opacity-0"
                >
                  <Spinner
                    data-tl-board-spinner
                    className="size-[calc(1.058*var(--tl-u))] shrink-0"
                  />
                  <span className="inline-block">
                    <RollingText text="creating your board" />
                  </span>
                </span>
                {/* done — absolute overlay; resting default (SSR / reduced-motion) */}
                <span
                  data-tl-board-done
                  className="pointer-events-none absolute inset-0 flex items-center justify-center gap-[calc(0.4*var(--tl-u))] leading-[1.2]"
                >
                  <Check
                    data-tl-board-check
                    className="size-[calc(1.058*var(--tl-u))] shrink-0 text-[#34c759]"
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
          {/* BOTTOM-anchored, not top — the one place the type-runs-hot tradeoff
              above actually bites. This label wraps to two lines beside a spine
              that is DESCENDING left-to-right here, so the lower a line sits, the
              further right the curve has travelled to meet it. Its box is sized
              in --tl-u, so at the hot type scale the pair of lines stands 52.2
              frame units tall instead of Figma's 38.4 — and top-anchored at
              16.09% that extra 13.8 pushed line two down to where the curve had
              already crossed under it (measured: 15 sampled path points inside
              the text box, second line 2 units left of the dots).
              Figma's box bottom is 196.4 of the 982 frame = exactly 80%, so
              anchoring THAT edge reproduces the design 1:1 at the artwork's own
              scale and grows upward — away from the curve — as the type runs
              hotter. Don't switch this back to `top`.

              `left` is then nudged 58.73% → 59.5%. The anchor alone takes the
              second line from 0px (literally touching the dots) to 3.6 frame
              units, but that IS the Figma gap — measured identical with the type
              unit pinned to the artwork's own 1cqw — and at this size the line
              still reads as grazing the spine. The spine runs diagonally here
              (~0.87 units of x per unit of y), so 0.77% of stage width buys 9.5
              units of daylight: line two clears by 13.1, line one by 27.7, or
              roughly two dashes of the 6-6 dash pattern. */}
          <p
            data-tl-float
            className="absolute bottom-[80%] left-[59.5%] w-[calc(4.7*var(--tl-u))] text-[calc(1.058*var(--tl-u))] leading-[1.2] text-white/90"
          >
            {DESIGNS_IN_REVIEW}
          </p>

          {/* ── day 12 — "revised until right" (746:4427). ── */}
          <div
            data-tl-beat="revised"
            // The one BEAT whose width rides the type unit. It is the narrowest
            // box in the composition (11.11cqw) and it holds the longest task
            // label — "landing page refresh" plus the refresh glyph pinned to
            // the pill's right edge. On raw cqw the label overruns the glyph and
            // the last letters disappear under it. Widening it costs nothing:
            // there is ~76px of clear sky before the day-23 beat, and the spine
            // passes well right of the new edge. The other beats stay on cqw —
            // they have slack, and widening them WOULD collide.
            className="absolute left-[57.14%] top-[43.89%] flex w-[calc(11.11*var(--tl-u))] flex-col gap-[0.397cqw]"
          >
            <CardText k="revised" />
            <TaskPill label="landing page refresh" padLeft="0.761cqw">
              {/* In-review chip: the refresh spins while "in progress", then
                  cross-fades to a green tick as the rainbow aura ignites — the
                  work landing "done". SSR / reduced-motion rest on the refresh
                  (the static in-review state); the tick + aura start hidden. */}
              <span
                data-tl-refresh
                className="relative grid size-[calc(1.588*var(--tl-u))] place-items-center rounded-full border-[0.079cqw] border-[#ffe8b7] bg-white text-[#737373]"
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
                  className="col-start-1 row-start-1 size-[calc(1.058*var(--tl-u))]"
                />
                <Check
                  data-tl-refresh-check
                  className="col-start-1 row-start-1 size-[calc(1.058*var(--tl-u))] text-[#34c759] opacity-0"
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

          {/* Scroll-scrubbed spine draw + dot pops + pen travel (renders null). */}
          <TimelineReveal />
        </div>
      </div>

      {/* The phone composition — same five beats, straightened. */}
      <TimelineMobile />
    </section>
  );
}

/**
 * The below-md timeline: the same journey read as a vertical list.
 *
 * WHY A SEPARATE COMPOSITION rather than a responsive one. The desktop artwork
 * is a single aspect-locked 1512×982 stage with every beat absolutely placed at
 * a `%` coordinate on that grid, threaded by one hand-authored SVG spine. There
 * is no arrangement of those coordinates that survives a 390px viewport: the
 * stage becomes 390×253, and everything inside it — type, cards, calendar,
 * spine — is multiplied by 0.258 together. Measured on the shipped build, the
 * subhead rendered at 4.1px and the endnote at 3.6px. The composition isn't
 * mis-sized on a phone; it's the wrong composition for one.
 *
 * So the phone gets the straight version of the same idea: one vertical dotted
 * spine down the left, a checkpoint dot per beat, and each beat's card stacked
 * in reading order. Day 1 → day 23 top to bottom, which is the same journey the
 * winding line describes, in the direction a phone already scrolls.
 *
 * WHAT IT REUSES. Every widget — CardText, TaskPill, Chip, ProgressChip,
 * BankedCalendar, the delivery still — is the SAME component the desktop stage
 * renders, not a copy. That works because their internals are expressed in the
 * two unit variables and nothing else: --tl-u for type, --tl-g for geometry.
 * Setting --tl-g to 15.12px (the design's own 1cqw at the 1512 frame) makes each
 * widget render at exactly its authored Figma size — 17px calendar cells, 0.5px
 * hairlines, a 38px task pill — instead of at a fraction of the phone's width.
 * --tl-u:18px is the same value the desktop clamp targets, so the words are the
 * size they were always meant to be.
 *
 * NO PIN, NO SCRUB. TimelineReveal early-returns below md (it drives the spine
 * mask, the pen and the beat cards, all of which only exist on the stage), so
 * this renders in the resting state — which is already the designed finished
 * state, the one SSR / no-JS / reduced-motion have always shown. That also
 * means the phone never meets this section's 200%-scroll pin, which is the
 * single largest structural risk in a touch scroll.
 */
function TimelineMobile() {
  return (
    <div
      // --tl-g at the design's own 1cqw, --tl-u at the size the desktop clamp
      // targets. Both are inherited by every widget below.
      className="px-6 [--tl-g:15.12px] [--tl-u:18px] md:hidden"
    >
      {/* @container + data-tl-mobile: timeline-micro.ts uses this element as
          both its query scope and the box the progress chip's width is measured
          against — it writes that width in `cqw`, so the element it measures
          has to be the one `cqw` resolves to. On desktop the stage plays the
          same role.
          ⚠️ It must carry NO PADDING. `cqw` resolves against a container's
          CONTENT box while the function measures getBoundingClientRect() (the
          border box); on the stage the two are identical because it has none,
          so any padding here would silently scale the progress chip by the
          ratio between them. The gutter lives on the parent instead. */}
      <div
        data-tl-mobile
        className="@container mx-auto flex w-full max-w-[372px] flex-col gap-[34px]"
      >
        {/* Header — the section heading takes the site's shared display token
            here rather than the stage's cqw size, so it matches every other
            heading on the page instead of the artwork it no longer sits in. */}
        <div className="flex flex-col gap-[10px] text-white">
          <h2 className="text-display leading-[1.1] tracking-[-0.03em]">
            <span className="font-light">{HEADING.lead}</span>
            <span className="font-instrument">{HEADING.accent}</span>
          </h2>
          <p className="text-[calc(1.058*var(--tl-u))] tracking-[0.02em] text-white/85">
            {HEADING.sub}
          </p>
        </div>

        {/* The spine, the beats, and the mark that CAPS the spine — one
            positioning context, so the dots and the mark place against the
            same left edge.

            The dotted line is its own absolutely-positioned element rather than
            a left border on the <ol>, for one reason: a border spans its
            element's entire height, so the line ran past the last beat and
            stopped in empty sky with the mark floating below it. Here it ENDS
            at the mark — the same relationship the drawn spine has on desktop,
            where the mark IS the pen that finishes the line. `bottom-[10px]` is
            half the endnote row's line box, i.e. the mark's vertical centre.

            The dashes are a repeating-gradient BACKGROUND on a real 1.5px-wide
            column, NOT `border-l-[1.5px] border-dashed` on a zero-width box:
            WebKit skips painting a dashed border when the box it belongs to has
            no width, so on iOS Safari the spine disappeared entirely while
            Blink (desktop Chrome and its device emulation) drew it — the bug
            can't be seen in devtools. The painted result is the same 1.5px
            column at left:0, so the dot centreline arithmetic below is
            unchanged, and 6/6 is the desktop spine's own strokeDasharray. */}
        <div className="relative pl-[26px]">
          <span
            aria-hidden
            className="absolute bottom-[10px] left-0 top-0 w-[1.5px] bg-[image:repeating-linear-gradient(to_bottom,rgba(255,255,255,0.85)_0_6px,transparent_6px_12px)]"
          />

          <ol className="m-0 flex list-none flex-col gap-[30px]">
            {BEATS.map((b) => (
              <li key={b.key} className="relative flex flex-col gap-[10px]">
                {/* Checkpoint dot, sitting ON the spine and level with the day
                    label's first line. Arithmetic, not taste: the <li> content
                    edge is the wrapper's 26px padding right of the spine's outer
                    edge, and the spine's centreline is 0.75px inside that, so
                    the dot's CENTRE belongs at -25.25px. `left` places its left
                    edge, so subtract half of its 9px → -29.75px. */}
                <span
                  aria-hidden
                  className="absolute -left-[29.75px] top-[7px] size-[9px] rounded-full bg-white ring-[1.5px] ring-white"
                />
                <CardText k={b.key} />
                <TimelineMobileWidget k={b.key} />
              </li>
            ))}
          </ol>

          {/* The endnote — the ascnd mark sits ON the spine's terminus, centred
              on the same 0.75px centreline as the dots (0.75 − half of its 20px
              − the 26px padding = −35.25px), with the words beside it.

              ROTATED 152.8°, and that number is measured rather than eyeballed.
              The mark is the PEN: on desktop TimelineReveal turns it to face the
              direction of travel, with `penRotation = angleAt(len) − endAngle`,
              so rotation 0 IS the artwork's end tangent — i.e. the glyph is
              authored pointing along the line's final direction. Sampled off
              [data-tl-mask] on the live stage, that tangent is −62.8° (up and to
              the right). This spine travels straight DOWN (+90° in the same
              screen convention), so the pen has to turn 90 − (−62.8) = 152.8° to
              hold the identical relationship to its line. */}
          <p className="relative mt-[30px] flex items-center text-[calc(0.926*var(--tl-u))] leading-[1.2] text-white/90">
            <AscndMark
              aria-hidden
              className="absolute -left-[35.25px] w-[20px] rotate-[152.8deg] text-white"
            />
            {AND_UP_WE_GO}
          </p>
        </div>

        {/* Drives the same four in-card loops the stage runs (renders null). */}
        <TimelineMicroMount />
      </div>
    </div>
  );
}

/**
 * The per-beat widget that hangs under each mobile card — the same bespoke
 * pieces the desktop beats carry, minus the ones that only make sense in the
 * artwork (the day-1 board button reads as a real CTA out of context, and the
 * floating "Designs in review" label has no curve to float on).
 */
function TimelineMobileWidget({ k }: { k: Parameters<typeof beat>[0] }) {
  if (k === "subscribe") {
    // The board button, carrying BOTH rows and the same data-tl-board-* hooks
    // the stage's copy has, so timeline-micro.ts drives the identical
    // loading→done loop here. The done row is the in-markup resting state
    // (SSR / no-JS / reduced-motion); the loop flips them on start.
    //
    // Sized in LITERAL PX — the only widget here that isn't on --tl-u/--tl-g,
    // and deliberately so. This is a replica of the site's real CTA, and on a
    // phone it stands beside real ones (the plan cards' buttons, a scroll
    // away), so it has to be that button's size exactly, not a unit-scaled
    // approximation of it. The values below ARE button.tsx's SHAPE, copied:
    // rounded-[32px] px-[20px] py-[7px] text-[16px], measured on /pricing at
    // 390px as a 38px-tall pill. Keep them in step with SHAPE if it ever moves.
    //
    // Why not the units. The stage's copy expresses the same button as factors
    // of the design's own 15.12px unit (1.323 → px, 0.463 → py, 1.058 → text,
    // 2.116 → radius), which is right there — the artwork scales as one piece.
    // On a phone that indirection only loses precision: 1.323 × 15.12 = 20.004,
    // 2.116 × 15.12 = 31.994. Riding --tl-u (18px, the deliberately hot TYPE
    // unit) was worse still — a 19px label in 23.8px of padding, 19% over the
    // button it imitates.
    //
    // leading-[1.5] on the rows below is part of the match, not styling: the
    // real button's 16px label sits in a 24px line box, so 1.2 made this pill
    // 33px tall next to its 38px. The aura numbers are likewise button.tsx's
    // own — a 3px ring, a 3px-inset glow, blur(9px).
    return (
      <div className="relative inline-flex items-center justify-center self-start whitespace-nowrap rounded-[32px] bg-gradient-to-b from-white to-[#efefef] px-[20px] py-[7px] text-[16px] text-[#263138] shadow-[inset_0px_-2px_1px_0px_#f2f2f2,inset_0px_-2px_2px_0px_rgba(0,0,0,0.5)]">
        <TimelineAura radius="32px" ring="3px" spread="3px" blur="9px" />
        <span className="relative flex">
          {/* loading — in-flow, reserves the (wider) width */}
          <span
            data-tl-board-loading
            className="pointer-events-none flex items-center gap-[7.5px] leading-[1.5] opacity-0"
          >
            <Spinner
              data-tl-board-spinner
              className="size-[16px] shrink-0"
            />
            <span className="inline-block">
              <RollingText text="creating your board" />
            </span>
          </span>
          {/* done — absolute overlay; resting default */}
          <span
            data-tl-board-done
            className="pointer-events-none absolute inset-0 flex items-center justify-center gap-[6px] leading-[1.5]"
          >
            <Check
              data-tl-board-check
              className="size-[16px] shrink-0 text-[#34c759]"
            />
            <span className="inline-block">
              <RollingText text="board created" />
            </span>
          </span>
        </span>
      </div>
    );
  }
  if (k === "first-request") {
    return (
      <div className="flex flex-col gap-[6px]">
        <TaskPill label="landing page refresh">
          <ProgressChip />
        </TaskPill>
        <TaskPill label="request anything">
          <Chip aura={false}>Brand</Chip>
        </TaskPill>
      </div>
    );
  }
  if (k === "delivery") {
    return (
      <div className="relative aspect-[192/141] w-[192px] max-w-full">
        <Image
          src="/timeline/day5-delivery.png"
          alt="the first delivered design, landed straight on your board"
          fill
          sizes="192px"
          className="rounded-[13px] object-cover"
        />
        <span className="absolute -right-[6px] -top-[6px] flex size-[18px] items-center justify-center rounded-full border-[0.5px] border-white/50 bg-gradient-to-b from-black/10 to-black/5 text-white shadow-[inset_0_0_0_999px_rgba(255,255,255,0.12)]">
          <Check className="size-[13px]" />
        </span>
      </div>
    );
  }
  if (k === "revised") {
    return (
      <TaskPill label="landing page refresh" padLeft="calc(0.761*var(--tl-g))">
        {/* Same data-tl-refresh-* hooks as the stage's, so the spin → green
            tick → aura loop runs here too. Resting on the refresh glyph is the
            static in-review state; the tick + aura start hidden by class. */}
        <span
          data-tl-refresh
          className="relative grid size-[calc(1.588*var(--tl-u))] place-items-center rounded-full border-[calc(0.079*var(--tl-g))] border-[#ffe8b7] bg-white text-[#737373]"
        >
          <span
            data-tl-refresh-aura
            className="pointer-events-none absolute inset-0 opacity-0"
          >
            <TimelineAura
              radius="9999px"
              ring="calc(0.11*var(--tl-g))"
              spread="calc(0.24*var(--tl-g))"
              blur="calc(0.34*var(--tl-g))"
            />
          </span>
          <Refresh
            data-tl-refresh-spin
            className="col-start-1 row-start-1 size-[calc(1.058*var(--tl-u))]"
          />
          <Check
            data-tl-refresh-check
            className="col-start-1 row-start-1 size-[calc(1.058*var(--tl-u))] text-[#34c759] opacity-0"
          />
        </span>
      </TaskPill>
    );
  }
  if (k === "pause") {
    // Pinned to the design card's own width (11.24cqw of the 1512 frame). The
    // calendar's divider is absolutely placed from the card's left edge for a
    // card exactly this wide; give it a rounder number and the 7-cell grid —
    // which centres itself — slides out from under the line.
    return (
      <div className="w-[calc(11.24*var(--tl-g))] max-w-full">
        <BankedCalendar />
      </div>
    );
  }
  return null;
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
    <div className="flex flex-col gap-[calc(0.463*var(--tl-u))]">
      <p className="text-[calc(0.794*var(--tl-u))] text-white/55">{b.day}</p>
      <p className="text-[calc(1.058*var(--tl-u))] tracking-[0.02em] text-white">
        {b.title}
      </p>
      <p className="text-[calc(0.794*var(--tl-u))] font-light leading-normal text-white/85">
        {b.body}
      </p>
    </div>
  );
}

/** A glass task row — label on the left, a chip / status on the right. Not
 *  clipped (overflow-visible) so a chip's aura can bloom past the pill edge. */
function TaskPill({
  label,
  padLeft = "calc(1.158 * var(--tl-u))",
  children,
}: {
  label: string;
  padLeft?: string;
  children: ReactNode;
}) {
  // Height rides the TYPE unit, not raw cqw: the row is sized around its label,
  // so a floored label in a stage-scaled pill would outgrow the capsule.
  return (
    <div className="relative flex h-[calc(2.116*var(--tl-u))] w-full items-center rounded-[calc(4.101*var(--tl-g))] border-[calc(0.033*var(--tl-g))] border-white/60 bg-gradient-to-b from-black/10 to-black/5 shadow-[inset_0_0_0_999px_rgba(255,255,255,0.06)]">
      <span
        className="text-[calc(0.728*var(--tl-u))] text-white"
        style={{ paddingLeft: padLeft }}
      >
        {label}
      </span>
      <span className="absolute right-[calc(0.221*var(--tl-u))] top-1/2 -translate-y-1/2">
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
    <span className="relative flex items-center justify-center rounded-[calc(2.05*var(--tl-g))] bg-white px-[calc(0.633*var(--tl-u))] py-[calc(0.317*var(--tl-u))] text-[calc(0.661*var(--tl-u))] leading-[1.5] text-[#263138]">
      {aura && (
        <TimelineAura radius="calc(2.05*var(--tl-g))" ring="calc(0.11*var(--tl-g))" spread="calc(0.26*var(--tl-g))" blur="calc(0.36*var(--tl-g))" />
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
    <span className="relative flex items-center justify-center rounded-[calc(2.05*var(--tl-g))] bg-white px-[calc(0.633*var(--tl-u))] py-[calc(0.317*var(--tl-u))] text-[calc(0.661*var(--tl-u))] leading-[1.5] text-[#263138]">
      <TimelineAura radius="calc(2.05*var(--tl-g))" ring="calc(0.11*var(--tl-g))" spread="calc(0.26*var(--tl-g))" blur="calc(0.36*var(--tl-g))" />
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
  // Veil, NOT backdrop-blur (docs/backdrop-filter-sweep.md): the backdrop here
  // is sky-only, and a live backdrop-filter under the reveal tween's ancestor
  // filter/opacity is what made this card SNAP at the end of its fade — the
  // ancestor filter suspends the frost, and it popped back on when clearProps
  // removed it. The veil fades with the card like any other paint.
  return (
    <div className="relative flex w-full flex-col items-center gap-[calc(0.463*var(--tl-g))] overflow-hidden rounded-[calc(0.7*var(--tl-g))] border-[calc(0.048*var(--tl-g))] border-white bg-gradient-to-b from-black/10 to-black/5 px-[calc(0.7*var(--tl-g))] py-[calc(0.661*var(--tl-g))] shadow-[inset_0_0_0_999px_rgba(255,255,255,0.06)]">
      {/* Subtle divider behind the grid (746:4445). It lies exactly on row 1's
          centerline — the RESTING design's static stand-in for the banked-run
          connector (days 1-6 rest solid there). TimelineReveal hides it while
          the bank loop animates, else it reads as a line drawn through days
          that haven't banked yet; SSR / reduced-motion keep it. */}
      <span
        data-tl-bank-divider
        className="pointer-events-none absolute left-[calc(1.671*var(--tl-g))] top-[calc(2.663*var(--tl-g))] h-[calc(0.033*var(--tl-g))] w-[calc(7.341*var(--tl-g))] bg-white"
      />
      {/* The "11 days banked" caption. TimelineReveal holds it back until the
          paused-days signs land each loop pass, then blur-rises it in word by
          word (the section headings' rise); resting markup shows it for
          SSR / reduced-motion. */}
      <div className="flex items-center gap-[calc(0.3*var(--tl-u))] text-white">
        <span data-tl-bank-label className="text-[calc(0.661*var(--tl-u))]">
          {BANKED_LABEL}
        </span>
        <Check data-tl-bank-check className="size-[calc(0.926*var(--tl-u))]" />
      </div>
      <div data-tl-grid className="relative flex flex-col items-center gap-[calc(0.322*var(--tl-g))]">
        {/* The "banked run" connector line (746:4444). It sits behind the cells
            — showing through the gaps like linked nodes — and TimelineReveal
            draws it in sync with the fill, snaking from day 1 (top-left) through
            each day as it fills (row 1 →, row 2 ←, row 3 →). Coordinates are the
            grid's design px (cell 17.065, gap 4.876), so the viewBox aspect
            matches the box and scales 1:1 with the cqw grid. */}
        <svg
          viewBox="0 0 148.71 104.83"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
        >
          <path
            data-tl-bank-trail
            d="M8.53 8.53 L140.18 8.53 L140.18 30.47 L8.53 30.47 L8.53 52.41 L52.41 52.41"
            stroke="white"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1}
          />
        </svg>
        {BANKED_GRID.map((row, r) => (
          <div key={r} className="flex gap-[calc(0.322*var(--tl-g))]">
            {row.map((cell, c) => (
              // The banking run is days 1–17: every non-pause cell in the first
              // three rows. Marking days 1–6 bankable too (not just the muted
              // days 7–17) is what lets the fill sweep BEGIN at day 1, top-left,
              // rather than at the lone muted day-7 cell in the top-right corner.
              <DayCell key={c} state={cell} bankable={r < 3 && cell !== "pause"} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCell({ state, bankable = false }: { state: Cell; bankable?: boolean }) {
  return (
    <div
      data-tl-cell
      data-tl-bankable={bankable ? "" : undefined}
      className={`flex size-[calc(1.129*var(--tl-g))] items-center justify-center rounded-full ${
        state === "solid" ? "bg-white" : state === "muted" ? "bg-white/50" : "bg-white/30"
      }`}
    >
      {state === "pause" && (
        <Pause data-tl-pause className="size-[calc(1.129*var(--tl-g))] text-white" />
      )}
    </div>
  );
}

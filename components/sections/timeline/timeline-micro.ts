"use client";

/**
 * The timeline's four in-card MICRO-LOOPS, extracted so both compositions can
 * run the identical animation.
 *
 * These are the beats' character — the day-1 board button creating→created, the
 * day-2 progress chip rolling UI/UX↔35% completed, the day-12 refresh spinning
 * then ticking green, the day-23 calendar banking day by day. They were written
 * inside timeline-reveal.tsx alongside the scrubbed master timeline, but they
 * have nothing to do with it: each is a self-contained infinite `gsap.timeline`
 * idled off-screen by its own IntersectionObserver, keyed to no scroll position
 * at all. An endless loop can't be scrubbed, which is why they were separate
 * even there.
 *
 * They live here because the phone composition (<TimelineMobile/>,
 * timeline.tsx) renders the very same widget components and therefore the very
 * same `data-tl-*` nodes, but NOT the stage the master timeline drives — no
 * spine to draw, no pen to ride it, no pinned scrub. Below md, TimelineReveal
 * bails and this module runs on its own against the mobile root; above md,
 * TimelineReveal calls it with the stage. One implementation, two mounts.
 *
 * `root` is both the query scope and the gsap.context scope, and it doubles as
 * the CONTAINER the progress chip's width is measured against — so it must be
 * the element that carries `@container` (the stage's wrapper on desktop, the
 * mobile column on phones), or the `cqw` width written below resolves against
 * the wrong box.
 *
 * Returns its own teardown; the caller owns when that runs.
 */

import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

export function initTimelineMicro(root: HTMLElement): () => void {
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel);
  const qa = <T extends Element>(sel: string) =>
    gsap.utils.toArray<T>(root.querySelectorAll(sel));

  const refreshSpin = q<SVGElement>("[data-tl-refresh-spin]");
  const refreshCheck = q<SVGElement>("[data-tl-refresh-check]");
  const refreshAura = q<HTMLElement>("[data-tl-refresh-aura]");
  const boardLoading = q<HTMLElement>("[data-tl-board-loading]");
  const boardDone = q<HTMLElement>("[data-tl-board-done]");
  const boardSpinner = q<SVGElement>("[data-tl-board-spinner]");
  const progLabel = q<HTMLElement>("[data-tl-prog-label]");
  const progFull = q<HTMLElement>("[data-tl-prog-full]");
  const progBox = q<HTMLElement>("[data-tl-prog-box]");
  const progLabelInner = q<HTMLElement>("[data-tl-prog-label-inner]");
  const progFullInner = q<HTMLElement>("[data-tl-prog-full-inner]");

  // Park the two cross-fading pairs onto their ANIMATED start state. Both rest
  // in markup on their finished row (that's the SSR / no-JS / reduced-motion
  // state), so each has to be flipped before the loop takes over or the first
  // cycle plays backwards.
  if (boardLoading) gsap.set(boardLoading, { autoAlpha: 1 });
  if (boardDone) gsap.set(boardDone, { autoAlpha: 0 });
  if (progLabel) gsap.set(progLabel, { autoAlpha: 1 });
  if (progFull) gsap.set(progFull, { autoAlpha: 0 });

  let boardIO: IntersectionObserver | undefined;
  let progIO: IntersectionObserver | undefined;
  let refreshIO: IntersectionObserver | undefined;
  let cellIO: IntersectionObserver | undefined;
  let bankSplit: SplitText | undefined;

  const ctx = gsap.context(() => {
    // ── day-1 button ────────────────────────────────────────────────────────
    // The text change is the subscribe card's PER-CHARACTER roll — the outgoing
    // row fades out and the incoming row's letters roll up one by one
    // (yPercent 110→0, staggered), the ✓ springing in. A dotted spinner spins
    // continuously (own tween, smooth). An IntersectionObserver pauses it all
    // off-screen (idle to zero).
    if (boardSpinner && boardLoading && boardDone) {
      const chars1 = gsap.utils.toArray<HTMLElement>(
        boardLoading.querySelectorAll("[data-char]"),
      );
      const chars2 = gsap.utils.toArray<HTMLElement>(
        boardDone.querySelectorAll("[data-char]"),
      );
      const boardCheck = boardDone.querySelector<SVGElement>("[data-tl-board-check]");

      const STAGGER = 0.03;
      const ROLL = 0.5;
      const FADE = 0.3;
      const CREATING = 2.0; // "creating" dwell
      const DONE_HOLD = 1.6; // "board created" dwell
      const tail = (n: number) => ROLL + Math.max(0, n - 1) * STAGGER;
      const tA = CREATING; // swap → created
      const tB = tA + 0.2 + tail(chars2.length) + DONE_HOLD; // swap → creating

      // Continuous spinner — its own smooth tween (repeats 0→360 seamlessly),
      // so it never stalls between cycles. ~0.9 rev/s.
      const spin = gsap.to(boardSpinner, {
        rotation: 360,
        duration: 1.15,
        ease: "none",
        repeat: -1,
        paused: true,
      });

      const loop = gsap.timeline({ repeat: -1, paused: true });
      loop
        .set(boardLoading, { autoAlpha: 1 }, 0)
        .set(boardDone, { autoAlpha: 0 }, 0)
        .set(chars1, { yPercent: 0 }, 0)
        .set(chars2, { yPercent: 110 }, 0)
        .set(boardCheck, { scale: 0 }, 0)
        // creating dwell (0 → tA), then swap to "board created":
        .to(boardLoading, { autoAlpha: 0, duration: FADE, ease: "power2.in" }, tA)
        .set(boardDone, { autoAlpha: 1 }, tA + 0.18)
        .to(
          chars2,
          { yPercent: 0, duration: ROLL, ease: "power3.out", stagger: STAGGER },
          tA + 0.2,
        )
        .fromTo(
          boardCheck,
          { scale: 0 },
          { scale: 1, duration: 0.34, ease: "back.out(3)" },
          tA + 0.22,
        )
        // created dwell, then swap back to "creating your board":
        .to(boardDone, { autoAlpha: 0, duration: FADE, ease: "power2.in" }, tB)
        .set(chars1, { yPercent: 110 }, tB + 0.001)
        .set(boardLoading, { autoAlpha: 1 }, tB + 0.18)
        .to(
          chars1,
          { yPercent: 0, duration: ROLL, ease: "power3.out", stagger: STAGGER },
          tB + 0.2,
        );
      boardIO = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            loop.play();
            spin.play();
          } else {
            loop.pause();
            spin.pause();
          }
        },
        { threshold: 0 },
      );
      boardIO.observe(boardLoading);
    }

    // ── day-2 first pill ────────────────────────────────────────────────────
    // The "UI/UX" category tag holds for 2s, then the chip WIDENS to fit the
    // longer copy and the text rolls PER-CHARACTER to "35% completed" (the same
    // subscribe-card roll); it holds, then shrinks + rolls back — forever.
    if (progLabel && progFull && progBox && progLabelInner && progFullInner) {
      const charsLabel = gsap.utils.toArray<HTMLElement>(
        progLabel.querySelectorAll("[data-char]"),
      );
      const charsFull = gsap.utils.toArray<HTMLElement>(
        progFull.querySelectorAll("[data-char]"),
      );

      // Measure both rows' natural widths and express them in cqw (px ÷ container
      // width × 100) so the chip stays correct when the composition rescales.
      // `root` IS the container element — see the header note.
      const rootW = root.getBoundingClientRect().width || 1;
      const toCqw = (px: number) => (px / rootW) * 100;
      const labelW = toCqw(progLabelInner.getBoundingClientRect().width);
      const fullW = toCqw(progFullInner.getBoundingClientRect().width);
      const w = { v: labelW };
      const setW = () => {
        progBox.style.width = `${w.v}cqw`;
      };
      setW(); // pin the resting width so the box no longer auto-sizes

      const STAGGER = 0.03;
      const ROLL = 0.5;
      const FADE = 0.3;
      const GROW = 0.4; // width tween — runs BEFORE the text rolls, so it never overflows
      const SWAP_GAP = 0.42; // fade-out/grow → roll-in offset
      const LABEL_HOLD = 2.0; // "UI/UX" dwell before flipping
      const FULL_HOLD = 1.6; // "35% completed" dwell
      const tail = (n: number) => ROLL + Math.max(0, n - 1) * STAGGER;
      const tA = LABEL_HOLD; // swap → 35% completed
      const tB = tA + SWAP_GAP + tail(charsFull.length) + FULL_HOLD; // swap → UI/UX

      const progLoop = gsap.timeline({ repeat: -1, paused: true });
      progLoop
        .set(w, { v: labelW }, 0)
        .set(progLabel, { autoAlpha: 1 }, 0)
        .set(progFull, { autoAlpha: 0 }, 0)
        .set(charsLabel, { yPercent: 0 }, 0)
        .set(charsFull, { yPercent: 110 }, 0)
        // label dwell (0 → tA), then fade out + widen, then roll "35% completed" in:
        .to(progLabel, { autoAlpha: 0, duration: FADE, ease: "power2.in" }, tA)
        .to(w, { v: fullW, duration: GROW, ease: "power2.inOut", onUpdate: setW }, tA)
        .set(progFull, { autoAlpha: 1 }, tA + SWAP_GAP - 0.02)
        .to(
          charsFull,
          { yPercent: 0, duration: ROLL, ease: "power3.out", stagger: STAGGER },
          tA + SWAP_GAP,
        )
        // progress dwell, then fade the wide text out FIRST, and only shrink
        // once it's gone — otherwise the still-visible (fading) "35% completed"
        // is wider than the narrowing box and its afterimage spills out of the
        // pill. Roll "UI/UX" back in after the shrink.
        .to(progFull, { autoAlpha: 0, duration: FADE, ease: "power2.in" }, tB)
        .to(
          w,
          { v: labelW, duration: GROW, ease: "power2.inOut", onUpdate: setW },
          tB + FADE,
        )
        .set(charsLabel, { yPercent: 110 }, tB + FADE)
        .set(progLabel, { autoAlpha: 1 }, tB + FADE + SWAP_GAP - 0.02)
        .to(
          charsLabel,
          { yPercent: 0, duration: ROLL, ease: "power3.out", stagger: STAGGER },
          tB + FADE + SWAP_GAP,
        );
      progIO = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) progLoop.play();
          else progLoop.pause();
        },
        { threshold: 0 },
      );
      progIO.observe(progLabel);
    }

    // ── day-12 ──────────────────────────────────────────────────────────────
    // The refresh icon spins "in progress" ~2s, then cross-fades to a green tick
    // as the rainbow aura ignites ("done"), holds, then resets to the spinner
    // and repeats — forever. A continuous spin tween keeps the icon turning
    // smoothly.
    if (refreshSpin && refreshCheck) {
      const SPIN_HOLD = 2.0; // "in progress" dwell
      const POP = 0.4; // tick spring-in
      const FADE = 0.25;
      const DONE_HOLD = 1.6; // "done" dwell on the tick + aura
      const tA = SPIN_HOLD; // swap → tick
      const tB = tA + POP + DONE_HOLD; // swap → spinner

      const spin = gsap.to(refreshSpin, {
        rotation: 360,
        duration: 1.0,
        ease: "none",
        repeat: -1,
        paused: true,
      });

      const refreshLoop = gsap.timeline({ repeat: -1, paused: true });
      refreshLoop
        .set(refreshSpin, { autoAlpha: 1 }, 0)
        .set(refreshCheck, { autoAlpha: 0, scale: 0.5 }, 0);
      if (refreshAura) refreshLoop.set(refreshAura, { autoAlpha: 0 }, 0);
      // in-progress dwell (0 → tA), then swap to the tick + aura:
      refreshLoop
        .to(refreshSpin, { autoAlpha: 0, duration: 0.2 }, tA)
        .fromTo(
          refreshCheck,
          { autoAlpha: 0, scale: 0.5 },
          { autoAlpha: 1, scale: 1, duration: POP, ease: "back.out(2)" },
          tA,
        );
      if (refreshAura) refreshLoop.to(refreshAura, { autoAlpha: 1, duration: 0.4 }, tA);
      // done dwell, then swap back to the spinner:
      refreshLoop.to(refreshCheck, { autoAlpha: 0, duration: FADE, ease: "power2.in" }, tB);
      if (refreshAura)
        refreshLoop.to(refreshAura, { autoAlpha: 0, duration: FADE, ease: "power2.in" }, tB);
      refreshLoop.set(refreshSpin, { autoAlpha: 1 }, tB + 0.18);

      refreshIO = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            refreshLoop.play();
            spin.play();
          } else {
            refreshLoop.pause();
            spin.pause();
          }
        },
        { threshold: 0 },
      );
      refreshIO.observe(refreshSpin);
    }

    // ── day-23 ──────────────────────────────────────────────────────────────
    // The whole banking run resets to empty and each day "banks" in turn from
    // day 1 (top-left) — smoothly brightening from white/50 to solid white and
    // STAYING solid — so the fill sweeps the grid in a boustrophedon snake
    // (row 1 →, row 2 ←, row 3 →) while a connector line draws through the
    // cells in lockstep. It flows through all 17 days (1 → 17), the paused-days
    // signs land, the "11 days banked" caption blur-rises in, the full board
    // holds, then everything gently resets and replays.
    const bankDom = qa<HTMLElement>("[data-tl-bankable]");
    const bankTrail = q<SVGPathElement>("[data-tl-bank-trail]");
    // The paused-days signs (days 18-28) — hidden until the fill lands.
    const pauseEls = qa<SVGElement>("[data-tl-pause]");
    // The "11 days banked" caption (label words + trailing check) — held back
    // further still: it captions the board only once the paused-days signs have
    // finished landing, rising word by word like the section headings.
    const bankLabel = q<HTMLElement>("[data-tl-bank-label]");
    const bankCheck = q<SVGElement>("[data-tl-bank-check]");
    const labelTargets: Element[] = [];
    if (bankLabel) {
      bankSplit = new SplitText(bankLabel, { type: "words" });
      labelTargets.push(...bankSplit.words);
    }
    if (bankCheck) labelTargets.push(bankCheck);
    // Snake order (boustrophedon): group the muted cells into rows by their
    // vertical position, then reverse every other row so the fill — and the
    // trail line — flow row-to-row without diagonal jump-backs.
    const bankRects = bankDom.map((el) => ({ el, r: el.getBoundingClientRect() }));
    bankRects.sort((a, b) => a.r.top - b.r.top);
    const bankRows: { el: HTMLElement; r: DOMRect }[][] = [];
    for (const it of bankRects) {
      const row = bankRows[bankRows.length - 1];
      if (row && Math.abs(row[0].r.top - it.r.top) < it.r.height * 0.5) row.push(it);
      else bankRows.push([it]);
    }
    const bankCells: HTMLElement[] = [];
    bankRows.forEach((row, ri) => {
      row.sort((a, b) => a.r.left - b.r.left);
      if (ri % 2 === 1) row.reverse();
      bankCells.push(...row.map((o) => o.el));
    });

    if (bankCells.length) {
      const MUTED = "rgba(255,255,255,0.5)";
      const SOLID = "rgba(255,255,255,1)";
      const FILL = 0.5; // per-cell brighten
      const STEP = 0.3; // gap between successive fills (overlaps → a flowing wave)
      const HOLD_FULL = 3.2; // dwell on the full board (signs + caption need ~1.9s of it)
      const RESET = 0.5; // gentle dim back to muted before replaying
      const PAUSE_IN = 0.4; // each paused-days sign's fade
      const PAUSE_STAGGER = 0.06;
      const lastFillEnd = (bankCells.length - 1) * STEP + FILL;
      // When the LAST paused-days sign has fully landed — the caption's cue.
      const pauseDone =
        lastFillEnd +
        (pauseEls.length ? PAUSE_IN + (pauseEls.length - 1) * PAUSE_STAGGER : 0);

      // Pin an explicit rgba resting colour so GSAP tweens rgba→rgba. The
      // Tailwind `bg-white/50` class computes to an oklab/color-mix value GSAP
      // can't parse, which made each cell blink transparent (the muted day
      // "disappearing" and leaving a gap in the row) when its tween began.
      gsap.set(bankCells, { backgroundColor: MUTED });
      if (pauseEls.length) gsap.set(pauseEls, { autoAlpha: 0 });
      if (labelTargets.length) gsap.set(labelTargets, { autoAlpha: 0 });
      // The STATIC row-1 divider (the resting design's stand-in for the
      // banked-run connector, timeline.tsx) stays hidden for the whole animated
      // session — the drawn [data-tl-bank-trail] replaces it, and left visible
      // it reads as a line through days that haven't banked.
      const bankDivider = q<HTMLElement>("[data-tl-bank-divider]");
      if (bankDivider) gsap.set(bankDivider, { autoAlpha: 0 });

      const bankLoop = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.6, // beat between passes
        paused: true,
      });
      // The connector line draws in step with the fill (proxy → dashoffset, the
      // same technique as the spine, so pathLength math stays reliable).
      if (bankTrail) {
        const td = { o: 1 };
        const setTrail = () => {
          bankTrail.style.strokeDashoffset = String(td.o);
        };
        // The draw LAGS the fill by one cell-fill: it starts once day 1 has
        // fully banked (t = FILL) and ends with the last day (lastFillEnd), so
        // the line never pokes into days that haven't banked yet.
        bankLoop
          .set(bankTrail, { autoAlpha: 1 }, 0)
          .set(td, { o: 1 }, 0)
          .add(setTrail, 0)
          .to(
            td,
            { o: 0, duration: lastFillEnd - FILL, ease: "none", onUpdate: setTrail },
            FILL,
          )
          .to(
            bankTrail,
            { autoAlpha: 0, duration: RESET, ease: "power2.inOut" },
            lastFillEnd + HOLD_FULL,
          );
      }
      // Fill each cell in turn; they persist solid (no settle-back).
      bankCells.forEach((cell, i) => {
        bankLoop.to(
          cell,
          { backgroundColor: SOLID, duration: FILL, ease: "power2.out" },
          i * STEP,
        );
      });
      // Once the fill lands on the last banked day, the paused-days signs
      // (18-28) fade in in turn — the "…and then you pause" beat — and fade back
      // out on reset so the next pass replays clean.
      if (pauseEls.length) {
        bankLoop
          .set(pauseEls, { autoAlpha: 0 }, 0)
          .to(
            pauseEls,
            {
              autoAlpha: 1,
              duration: PAUSE_IN,
              ease: "power2.out",
              stagger: PAUSE_STAGGER,
            },
            lastFillEnd,
          )
          .to(
            pauseEls,
            { autoAlpha: 0, duration: RESET, ease: "power2.inOut" },
            lastFillEnd + HOLD_FULL,
          );
      }
      // …and only THEN the "11 days banked" caption — the same word-by-word
      // blur-rise the section headings use (the check trails as the final
      // "word"), fading out with everything else on reset. No clearProps: the
      // loop repeats, and the fromTo re-seeds the parked state each pass.
      if (labelTargets.length) {
        bankLoop
          .fromTo(
            labelTargets,
            { yPercent: 40, autoAlpha: 0, filter: "blur(8px)" },
            {
              yPercent: 0,
              autoAlpha: 1,
              filter: "blur(0px)",
              duration: 0.7,
              ease: "power3.out",
              stagger: 0.06,
            },
            pauseDone,
          )
          .to(
            labelTargets,
            { autoAlpha: 0, duration: RESET, ease: "power2.inOut" },
            lastFillEnd + HOLD_FULL,
          );
      }
      // Hold the full grid, then ease the whole run back to muted to replay.
      bankLoop.to(
        bankCells,
        { backgroundColor: MUTED, duration: RESET, ease: "power2.inOut" },
        lastFillEnd + HOLD_FULL,
      );

      cellIO = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) bankLoop.play();
          else bankLoop.pause();
        },
        { threshold: 0 },
      );
      cellIO.observe(bankCells[0]);
    }
  }, root);

  return () => {
    boardIO?.disconnect();
    progIO?.disconnect();
    refreshIO?.disconnect();
    cellIO?.disconnect();
    // Inline styles written outside GSAP's own bookkeeping (a raw style write in
    // an onUpdate, and the chip's pinned width) — ctx.revert() doesn't know
    // about either, so they're cleared by hand.
    progBox?.style.removeProperty("width");
    q<SVGPathElement>("[data-tl-bank-trail]")?.style.removeProperty(
      "stroke-dashoffset",
    );
    ctx.revert();
    bankSplit?.revert();
    // Restore the cross-fading pairs to their resting (finished) markup — the
    // opacity clears revert the tick + aura to their class-hidden state.
    gsap.set(
      [
        refreshSpin,
        refreshCheck,
        refreshAura,
        boardLoading,
        boardDone,
        boardSpinner,
        progLabel,
        progFull,
      ].filter(Boolean) as Element[],
      { clearProps: "opacity,visibility,transform" },
    );
  };
}

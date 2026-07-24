"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { DOTS } from "./timeline-path";

gsap.registerPlugin(ScrollTrigger, SplitText);

// useLayoutEffect on the client (park before paint if already scrolled here);
// falls back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * "your first month, plotted" scroll reveal — BOUND TO SCROLL (scrubbed). The
 * master timeline (heading, spine draw, dots, cards, endnote) no longer plays
 * once on enter: its playhead is tied to scroll position, so scrolling down
 * draws the line and scrolling up un-draws it. It uses the SAME draw mechanism
 * as the home page's "simple pricing" connector (pricing-reveal.tsx /
 * pricing-icons.tsx): a fat solid brush masks the dotted spine and its
 * strokeDashoffset wipes 1→0 so the line draws on smoothly — no per-frame
 * length maths, no "racing" head.
 *
 * TWO SCROLL MODES, switchable per-visit with the ?tl= query param (the house
 * A/B pattern — cf. ?intro / ?tier / ?noclouds) while the team picks one:
 *   ?tl=scrub — no pin: the draw advances as the stage travels the viewport
 *     (start/end in SCRUB_START/SCRUB_END below).
 *   ?tl=pin (DEFAULT — the team's pick) — the section pins to the viewport
 *     and PIN_DISTANCE of scroll drives the draw (plus a PIN_HOLD beat on the
 *     finished composition) before it releases. NB the stage is taller than a
 *     16:9 viewport, so a sliver of top/bottom clips while pinned — a known
 *     trade-off of this mode.
 * Flip DEFAULT_MODE to change what ships without a param.
 *
 * What THIS section adds on top of that shared approach:
 *   • the ascnd mark rides the draw-head as the "pen" (moved to
 *     getPointAtLength(p·L) each frame, self-calibrated so p=1 lands its foot
 *     back on the terminus), and
 *   • each day's content REVEALS as the head passes it — the beat cards, the
 *     floating "Designs in review" label, and the milestone dots are hidden,
 *     then fade / blur-rise in at the moment the head reaches their point on the
 *     path (placed on the timeline via the ease's inverse, so they stay locked
 *     to the visual head whatever power1.inOut does).
 *
 * HEADING — the same word-by-word blur-rise the pricing/cards headings use
 * (SplitText by words), the sub a beat later.
 *
 * The in-card micro-LOOPS (day-1 board, day-2 progress chip, day-12 refresh,
 * day-23 bank fill) are infinite and therefore stay TIME-BASED, gated by their
 * IntersectionObservers — an endless loop can't be scrubbed.
 *
 * Renders nothing — drives the [data-tl-*] / [data-timeline-*] nodes in
 * timeline.tsx. House rules: rides GSAP's shared ticker (LenisProvider); the
 * scrubbed timeline only advances with scroll (idles to zero); SSR / no-JS /
 * reduced-motion render the FINISHED composition (spine drawn, cards + dots
 * shown), hidden only once we know we'll animate.
 */

// PATH_TRANSFORM "translate(-2 70.66)" — path-local → frame shift (timeline-path.ts).
const TX = -2;
const TY = 70.66;
const FRAME_W = 1512;
const FRAME_H = 982;

const DRAW_DURATION = 2.5; // power1.inOut wipe — the pricing connector's feel, ~3s total incl. heading + tail
const DRAW_EASE = "power1.inOut";
const DRAW_AT = 0.35; // the draw starts a beat after the heading begins
const SAMPLES = 600; // path samples used to place each dot/card on the head

// ── Scroll binding (team A/B — see header) ──────────────────────────────────
// Under scrub, timeline "seconds" above become scroll PROPORTIONS — the
// relative pacing (heading → draw → endnote) is unchanged, scroll just owns
// the playhead.
type ScrollMode = "scrub" | "pin";
const DEFAULT_MODE: ScrollMode = "pin"; // what ships without a ?tl= param (team pick, 2026-07-24)
const SCRUB_START = "top 75%"; // same entry line the old once-trigger used
const SCRUB_END = "bottom bottom"; // pen lands as the stage fills the viewport
const PIN_START = "center center"; // stage centered; the section's py-[10dvh] absorbs the overflow at the 1512×982 design ratio
const PIN_DISTANCE = "+=200%"; // scroll length driving the draw while pinned
const PIN_HOLD = 0.6; // beat of dead scroll on the finished composition before the pin releases

export default function TimelineReveal() {
  useIsomorphicLayoutEffect(() => {
    const stage = document.querySelector<HTMLElement>("[data-tl-stage]");
    if (!stage) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    // ?tl=pin | ?tl=scrub picks the scroll mode for this visit (team A/B).
    const qMode = new URLSearchParams(window.location.search).get("tl");
    const mode: ScrollMode =
      qMode === "pin" || qMode === "scrub" ? qMode : DEFAULT_MODE;

    const maskPath = stage.querySelector<SVGPathElement>("[data-tl-mask]");
    const pen = stage.querySelector<SVGElement>("[data-tl-pen]");
    const heading = stage.querySelector<HTMLElement>("[data-timeline-head]");
    const sub = stage.querySelector<HTMLElement>("[data-timeline-sub]");
    const endnote = stage.querySelector<HTMLElement>("[data-tl-endnote]");
    const float = stage.querySelector<HTMLElement>("[data-tl-float]");
    const dotEls = gsap.utils.toArray<SVGCircleElement>(
      stage.querySelectorAll("[data-tl-dot]"),
    );
    const beatEls = gsap.utils.toArray<HTMLElement>(
      stage.querySelectorAll("[data-tl-beat]"),
    );
    if (!maskPath || !pen || !dotEls.length) return;

    // In-card micro-animation targets (any may be absent).
    const stampEl = stage.querySelector<HTMLElement>("[data-tl-stamp]");
    const cellEls = gsap.utils.toArray<HTMLElement>(
      stage.querySelectorAll("[data-tl-cell]"),
    );
    const refreshSpin = stage.querySelector<SVGElement>("[data-tl-refresh-spin]");
    const refreshCheck = stage.querySelector<SVGElement>("[data-tl-refresh-check]");
    const refreshAura = stage.querySelector<HTMLElement>("[data-tl-refresh-aura]");
    const boardLoading = stage.querySelector<HTMLElement>("[data-tl-board-loading]");
    const boardDone = stage.querySelector<HTMLElement>("[data-tl-board-done]");
    const boardSpinner = stage.querySelector<SVGElement>("[data-tl-board-spinner]");
    const progLabel = stage.querySelector<HTMLElement>("[data-tl-prog-label]");
    const progFull = stage.querySelector<HTMLElement>("[data-tl-prog-full]");
    const progBox = stage.querySelector<HTMLElement>("[data-tl-prog-box]");
    const progLabelInner = stage.querySelector<HTMLElement>(
      "[data-tl-prog-label-inner]",
    );
    const progFullInner = stage.querySelector<HTMLElement>(
      "[data-tl-prog-full-inner]",
    );

    const L = maskPath.getTotalLength();
    const toPct = (fx: number, fy: number) => ({
      x: (fx / FRAME_W) * 100,
      y: (fy / FRAME_H) * 100,
    });

    // Pen foot offset: measure the mark's finished resting box (its foot on the
    // terminus, hand-tuned in timeline.tsx) and subtract the geometric terminus,
    // so the travel lands p=1 back on that exact spot — no magic numbers here.
    const stageRect = stage.getBoundingClientRect();
    const penRect = pen.getBoundingClientRect();
    const restLeftPct = ((penRect.left - stageRect.left) / stageRect.width) * 100;
    const restTopPct = ((penRect.top - stageRect.top) / stageRect.height) * 100;
    const endPt = maskPath.getPointAtLength(L);
    const endPct = toPct(endPt.x + TX, endPt.y + TY);
    const footOffX = restLeftPct - endPct.x;
    const footOffY = restTopPct - endPct.y;

    // The pen FACES its direction of travel: each frame the mark rotates about
    // its foot to the path tangent. The PIVOT is the measured contact point —
    // where the terminus sits inside the pen's own box at rest. The glyph's
    // foot is INSET from the element's corner (the rest position is hand-tuned
    // in timeline.tsx), so pivoting on a box corner would swing the glyph off
    // the line as it turns; pivoting on the measured point keeps it planted on
    // the head. Expressed in % of the box so it survives the stage rescaling.
    // Angles are measured RELATIVE to the end tangent — the same
    // self-calibration as the foot offset — so p=1 lands the mark back at its
    // designed upright rest (rotation 0), and everywhere else it keeps that
    // same relationship to the line. The stage shares the viewBox's aspect, so
    // frame-space angles are screen-space angles.
    const footOrigin = `${(((stageRect.left + (endPct.x / 100) * stageRect.width - penRect.left) / penRect.width) * 100).toFixed(2)}% ${(((stageRect.top + (endPct.y / 100) * stageRect.height - penRect.top) / penRect.height) * 100).toFixed(2)}%`;
    const TAN_EPS = Math.max(1, L / 1000);
    const angleAt = (len: number) => {
      const a = maskPath.getPointAtLength(Math.max(0, len - TAN_EPS));
      const b = maskPath.getPointAtLength(Math.min(L, len + TAN_EPS));
      return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    };
    const endAngle = angleAt(L);
    const penRotation = (len: number) => angleAt(len) - endAngle;

    // Progress (0..1) at which the head reaches each dot: sample the path once and
    // match each dot (frame coords) to its nearest sample. Index maps 1:1 to DOTS.
    const dots = dotEls.map((el, i) => ({
      el,
      beat: DOTS[i]?.beat,
      cx: DOTS[i]?.cx ?? Number(el.getAttribute("cx")),
      cy: DOTS[i]?.cy ?? Number(el.getAttribute("cy")),
      p: 1,
      best: Infinity,
    }));
    for (let s = 0; s <= SAMPLES; s++) {
      const len = (s / SAMPLES) * L;
      const pt = maskPath.getPointAtLength(len);
      const fx = pt.x + TX;
      const fy = pt.y + TY;
      for (const d of dots) {
        const dx = fx - d.cx;
        const dy = fy - d.cy;
        const dist = dx * dx + dy * dy;
        if (dist < d.best) {
          d.best = dist;
          d.p = len / L;
        }
      }
    }
    const pByBeat = new Map<string, number>();
    for (const d of dots) if (d.beat) pByBeat.set(d.beat, d.p);

    // Each beat card reveals at its dot's progress; the "Designs in review" float
    // reveals at the deco dot near it (DOTS[4], on the upper arc).
    type Reveal = { el: HTMLElement; p: number };
    const cardReveals: Reveal[] = beatEls
      .map((el) => {
        const key = el.dataset.tlBeat ?? "";
        const p = pByBeat.get(key);
        return p == null ? null : { el, p };
      })
      .filter((r): r is Reveal => r != null);
    if (float) cardReveals.push({ el: float, p: dots[4]?.p ?? 0.55 });

    // Ease inverse: given a target progress, the fraction of DRAW_DURATION at
    // which the head (eased) reaches it — so pops/reveals stay locked to the head.
    const easeFn = gsap.parseEase(DRAW_EASE);
    const timeForP = (target: number) => {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 32; i++) {
        const mid = (lo + hi) / 2;
        if (easeFn(mid) < target) lo = mid;
        else hi = mid;
      }
      return DRAW_AT + ((lo + hi) / 2) * DRAW_DURATION;
    };
    // When a beat's day reveals (its dot's progress → timeline time).
    const beatTime = (key: string) => {
      const p = pByBeat.get(key);
      return p == null ? DRAW_AT : timeForP(p);
    };

    // ── Park everything empty synchronously (before fonts resolve), so nothing
    //    flashes finished if the page loads already scrolled here. ──
    const hidden = [heading, sub, endnote, ...cardReveals.map((r) => r.el)].filter(
      (el): el is HTMLElement => el != null,
    );
    gsap.set(hidden, { autoAlpha: 0 });
    gsap.set(dots.map((d) => d.el), { autoAlpha: 0 });
    maskPath.style.strokeDashoffset = "1"; // spine empty
    // Rotation pivots on the measured foot — the point that rides the line.
    gsap.set(pen, {
      autoAlpha: 0,
      transformOrigin: footOrigin,
      rotation: penRotation(0),
    });
    const startPt = maskPath.getPointAtLength(0);
    const startPct = toPct(startPt.x + TX, startPt.y + TY);
    pen.style.left = `${startPct.x + footOffX}%`;
    pen.style.top = `${startPct.y + footOffY}%`;
    // Micro-animation resets (reduced-motion returned above, so finished-state
    // markup stays put there). The refresh tick + aura are hidden via class.
    // The banked-calendar cells rest at their design states (the bank pulse is
    // a transient highlight, so nothing is parked hidden).
    if (stampEl) gsap.set(stampEl, { autoAlpha: 0, scale: 0.6 });
    // day-1 board starts on the loading state (spinner + "creating your board");
    // the done row is the resting default, so flip them for the animation.
    if (boardLoading) gsap.set(boardLoading, { autoAlpha: 1 });
    if (boardDone) gsap.set(boardDone, { autoAlpha: 0 });
    // day-2 first pill rests on the "UI/UX" label (progress row hidden).
    if (progLabel) gsap.set(progLabel, { autoAlpha: 1 });
    if (progFull) gsap.set(progFull, { autoAlpha: 0 });

    let ctx: gsap.Context | undefined;
    let split: SplitText | undefined;
    let boardIO: IntersectionObserver | undefined;
    let progIO: IntersectionObserver | undefined;
    let refreshIO: IntersectionObserver | undefined;
    let cellIO: IntersectionObserver | undefined;
    let cancelled = false;

    const build = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        // SCRUBBED master timeline — scroll owns the playhead in both modes.
        // Pin mode pins the whole <section> (not the stage) so the section's
        // vertical padding rides along. pinSpacing must be set EXPLICITLY:
        // the sections are direct children of the flex-column <body>
        // (layout.tsx), and ScrollTrigger silently defaults pinSpacing to
        // false inside flex parents — which let the next section scroll
        // straight over the pinned stage.
        const tl = gsap.timeline({
          scrollTrigger:
            mode === "pin"
              ? {
                  trigger: stage.closest<HTMLElement>("[data-timeline]") ?? stage,
                  start: PIN_START,
                  end: PIN_DISTANCE,
                  pin: true,
                  pinSpacing: true,
                  anticipatePin: 1,
                  scrub: true,
                }
              : {
                  trigger: stage,
                  start: SCRUB_START,
                  end: SCRUB_END,
                  scrub: true,
                },
        });

        // Heading words blur-rise (SplitText), sub a beat later.
        if (heading) {
          split = new SplitText(heading, { type: "words" });
          gsap.set(heading, { autoAlpha: 1 }); // container shown; words parked below
          tl.fromTo(
            split.words,
            { yPercent: 40, autoAlpha: 0, filter: "blur(8px)" },
            {
              yPercent: 0,
              autoAlpha: 1,
              filter: "blur(0px)",
              duration: 0.7,
              ease: "power3.out",
              stagger: 0.06,
              clearProps: "filter",
            },
            0,
          );
        }
        if (sub) {
          tl.fromTo(
            sub,
            { autoAlpha: 0, y: 12 },
            { autoAlpha: 1, y: 0, duration: 0.7, ease: "power2.out" },
            0.3,
          );
        }

        // The spine DRAWS on: wipe the brush's strokeDashoffset 1→0 (same as the
        // pricing connector) through a proxy + onUpdate, and ride the pen on the
        // head each frame (drawn fraction p = 1 − o → getPointAtLength(p·L)),
        // rotating it to face the direction of travel (penRotation).
        const draw = { o: 1 };
        const setPenRot = gsap.quickSetter(pen, "rotation", "deg");
        tl.set(pen, { autoAlpha: 1 }, DRAW_AT);
        tl.to(
          draw,
          {
            o: 0,
            duration: DRAW_DURATION,
            ease: DRAW_EASE,
            onUpdate: () => {
              maskPath.style.strokeDashoffset = String(draw.o);
              const p = 1 - draw.o;
              const pt = maskPath.getPointAtLength(p * L);
              const c = toPct(pt.x + TX, pt.y + TY);
              pen.style.left = `${c.x + footOffX}%`;
              pen.style.top = `${c.y + footOffY}%`;
              setPenRot(penRotation(p * L));
            },
          },
          DRAW_AT,
        );

        // Dots FADE in as the head passes them (placed via the ease inverse) — a
        // pure opacity fade in place, no scale/movement: they just light up where
        // the pen has travelled.
        for (const d of dots) {
          tl.fromTo(
            d.el,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.45, ease: "power2.out" },
            timeForP(d.p),
          );
        }

        // Each day's content reveals as the head reaches it.
        for (const r of cardReveals) {
          tl.fromTo(
            r.el,
            { autoAlpha: 0, y: 16, filter: "blur(8px)" },
            {
              autoAlpha: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.6,
              ease: "power3.out",
              clearProps: "filter",
            },
            timeForP(r.p),
          );
        }

        // ── In-card micro-animations, each keyed to its day's reveal moment. ──

        // day-5: the delivery ✓ badge stamps onto the design.
        if (stampEl) {
          tl.fromTo(
            stampEl,
            { autoAlpha: 0, scale: 0.6 },
            { autoAlpha: 1, scale: 1, duration: 0.4, ease: "back.out(1.8)" },
            beatTime("delivery") + 0.3,
          );
        }

        // day-12: the refresh spin → tick + aura runs as its own INFINITE loop
        // (built below with the board/prog loops), so it repeats forever rather
        // than resting on the tick after one pass.

        // day-23: the banked-calendar "days accumulating" fill runs as its own
        // INFINITE loop (built below with the other beat loops), so the grid
        // banks up, holds, clears, and re-banks forever.

        // Endnote settles as the pen lands.
        if (endnote) {
          tl.fromTo(
            endnote,
            { autoAlpha: 0, y: 6 },
            { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" },
            DRAW_AT + DRAW_DURATION - 0.35,
          );
        }

        // Pin mode: a beat of dead scroll on the finished composition, so the
        // pin doesn't release the instant the pen lands.
        if (mode === "pin") {
          tl.to({}, { duration: PIN_HOLD }, DRAW_AT + DRAW_DURATION);
        }

        // day-1 button: an INFINITE loop, separate from the once main timeline.
        // The text change is the subscribe card's PER-CHARACTER roll — the
        // outgoing row fades out and the incoming row's letters roll up one by one
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

        // day-2 first pill: an INFINITE loop, separate from the once main
        // timeline. The "UI/UX" category tag holds for 2s, then the chip WIDENS
        // to fit the longer copy and the text rolls PER-CHARACTER to "35%
        // completed" (the same subscribe-card roll); it holds, then shrinks +
        // rolls back — forever. An IntersectionObserver idles it off-screen.
        if (progLabel && progFull && progBox && progLabelInner && progFullInner) {
          const charsLabel = gsap.utils.toArray<HTMLElement>(
            progLabel.querySelectorAll("[data-char]"),
          );
          const charsFull = gsap.utils.toArray<HTMLElement>(
            progFull.querySelectorAll("[data-char]"),
          );

          // Measure both rows' natural widths and express them in cqw (px ÷ stage
          // width × 100) so the chip stays correct when the composition rescales.
          const stageW = stage.getBoundingClientRect().width || 1;
          const toCqw = (px: number) => (px / stageW) * 100;
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
            // once it's gone — otherwise the still-visible (fading) "35%
            // completed" is wider than the narrowing box and its afterimage spills
            // out of the pill. Roll "UI/UX" back in after the shrink.
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

        // day-12: an INFINITE loop, separate from the once main timeline. The
        // refresh icon spins "in progress" ~2s, then cross-fades to a green tick
        // as the rainbow aura ignites ("done"), holds, then resets to the spinner
        // and repeats — forever. A continuous spin tween keeps the icon turning
        // smoothly; an IntersectionObserver idles it all off-screen.
        if (refreshSpin && refreshCheck) {
          const SPIN_HOLD = 2.0; // "in progress" dwell
          const POP = 0.4; // tick spring-in
          const FADE = 0.25;
          const DONE_HOLD = 1.6; // "done" dwell on the tick + aura
          const tA = SPIN_HOLD; // swap → tick
          const tB = tA + POP + DONE_HOLD; // swap → spinner

          // Continuous spin — its own smooth tween (0→360 repeats seamlessly), so
          // the icon never stalls between cycles. ~1 rev/s (matches the old spin).
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
          refreshLoop.to(
            refreshCheck,
            { autoAlpha: 0, duration: FADE, ease: "power2.in" },
            tB,
          );
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

        // day-23: an INFINITE loop, separate from the once main timeline. The
        // whole banking run resets to empty and each day "banks" in turn from
        // day 1 (top-left) — smoothly brightening from white/50 to solid white
        // and STAYING solid — so the fill sweeps the grid in a boustrophedon
        // snake (row 1 →, row 2 ←, row 3 →) while a connector line draws through
        // the cells in lockstep. It flows through all 17 days (1 → 17), holds on
        // the full board, then gently resets and replays. An IntersectionObserver
        // idles it off-screen.
        const bankDom = gsap.utils.toArray<HTMLElement>(
          stage.querySelectorAll("[data-tl-bankable]"),
        );
        const bankTrail = stage.querySelector<SVGPathElement>("[data-tl-bank-trail]");
        // The paused-days signs (days 18-28) — hidden until the fill lands.
        const pauseEls = gsap.utils.toArray<SVGElement>(
          stage.querySelectorAll("[data-tl-pause]"),
        );
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
          const HOLD_FULL = 2.5; // dwell on the full board (banked days + paused-days signs)
          const RESET = 0.5; // gentle dim back to muted before replaying
          const lastFillEnd = (bankCells.length - 1) * STEP + FILL;

          // Pin an explicit rgba resting colour so GSAP tweens rgba→rgba. The
          // Tailwind `bg-white/50` class computes to an oklab/color-mix value
          // GSAP can't parse, which made each cell blink transparent (the muted
          // day "disappearing" and leaving a gap in the row) when its tween
          // began. With a clean rgba start the fill just fades in place.
          gsap.set(bankCells, { backgroundColor: MUTED });
          // The paused-days signs stay hidden until the fill completes.
          if (pauseEls.length) gsap.set(pauseEls, { autoAlpha: 0 });

          const bankLoop = gsap.timeline({
            repeat: -1,
            repeatDelay: 0.6, // beat between passes
            paused: true,
          });
          // The connector line draws in step with the fill (proxy → dashoffset,
          // the same technique as the spine, so pathLength math stays reliable).
          if (bankTrail) {
            const td = { o: 1 };
            const setTrail = () => {
              bankTrail.style.strokeDashoffset = String(td.o);
            };
            bankLoop
              .set(bankTrail, { autoAlpha: 1 }, 0)
              .set(td, { o: 1 }, 0)
              .add(setTrail, 0)
              .to(td, { o: 0, duration: lastFillEnd, ease: "none", onUpdate: setTrail }, 0)
              .to(bankTrail, { autoAlpha: 0, duration: RESET, ease: "power2.inOut" }, lastFillEnd + HOLD_FULL);
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
          // (18-28) fade in in turn — the "…and then you pause" beat — and fade
          // back out on reset so the next pass replays clean.
          if (pauseEls.length) {
            bankLoop
              .set(pauseEls, { autoAlpha: 0 }, 0)
              .to(
                pauseEls,
                { autoAlpha: 1, duration: 0.4, ease: "power2.out", stagger: 0.06 },
                lastFillEnd,
              )
              .to(
                pauseEls,
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
      }, stage);

      // The pin's spacer pushes everything below the section down. The other
      // sections' triggers also build behind fonts.ready in their own effects
      // (order not guaranteed), so any built before this one measured the
      // un-spaced layout — re-measure them all once the pin exists.
      if (mode === "pin") ScrollTrigger.refresh();
    };

    // Defer until fonts are ready so SplitText measures real glyph metrics.
    if (!document.fonts || document.fonts.status === "loaded") build();
    else document.fonts.ready.then(build);

    return () => {
      cancelled = true;
      boardIO?.disconnect();
      progIO?.disconnect();
      refreshIO?.disconnect();
      cellIO?.disconnect();
      progBox?.style.removeProperty("width");
      stage
        .querySelector<SVGPathElement>("[data-tl-bank-trail]")
        ?.style.removeProperty("stroke-dashoffset");
      ctx?.revert();
      split?.revert();
      // Drop the synchronous parks so the finished layout shows if we never built.
      maskPath.style.removeProperty("stroke-dashoffset");
      pen.style.removeProperty("left");
      pen.style.removeProperty("top");
      gsap.set(pen, { clearProps: "opacity,visibility,transform,transformOrigin" });
      gsap.set(dots.map((d) => d.el), { clearProps: "transform,opacity,visibility" });
      gsap.set(hidden, { clearProps: "opacity,visibility,transform,filter" });
      // Restore the micro-animation targets (opacity clears revert the tick/aura
      // to their class-hidden state).
      const micro = [
        stampEl,
        refreshSpin,
        refreshCheck,
        refreshAura,
        boardLoading,
        boardDone,
        boardSpinner,
        progLabel,
        progFull,
        ...cellEls,
      ].filter((el): el is HTMLElement | SVGElement => el != null);
      if (micro.length)
        gsap.set(micro, { clearProps: "opacity,visibility,transform,backgroundColor" });
    };
  }, []);

  return null;
}

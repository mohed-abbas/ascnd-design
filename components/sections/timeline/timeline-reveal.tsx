"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { initTimelineMicro } from "./timeline-micro";
import { DOTS, PATH_D } from "./timeline-path";

gsap.registerPlugin(ScrollTrigger, SplitText);

// useLayoutEffect on the client (park before paint if already scrolled here);
// falls back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
// The same breakpoint timeline.tsx switches the composition on, and the string
// every other heavy-feature gate on the site uses (cloud-layer.tsx,
// intro-state.ts) so a phone resolves them all identically.
const SMALL_SCREEN = "(max-width: 768px)";

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
 * SCROLL BINDING — the section PINS to the viewport and PIN_DISTANCE of scroll
 * drives the draw (plus a PIN_HOLD beat on the finished composition) before it
 * releases. The stage caps its width to the viewport height (timeline.tsx) so
 * the whole composition fits a single viewport while pinned, CENTERED — with a
 * straight lead-in prepended to the spine (see LEAD-IN below) so the line still
 * starts at the viewport's left margin. (Picked over an unpinned travel-scrub
 * in the 2026-07-24 A/B.)
 *
 * What THIS section adds on top of that shared approach:
 *   • the ascnd mark rides the draw-head as the "pen" (moved to
 *     getPointAtLength(p·L) each frame, self-calibrated so p=1 lands its foot
 *     back on the terminus), and
 *   • each day's content REVEALS ahead of the head — the beat cards and the
 *     floating "Designs in review" label fade / blur-rise in as the head
 *     approaches and are COMPLETELY revealed the moment it reaches their point
 *     on the path (the tween ENDS at the arrival time, which is found via the
 *     ease's inverse, so they stay locked to the visual head whatever
 *     power1.inOut does), and
 *   • the milestone dots are two-state CHECKPOINTS: they park as hollow rings
 *     that soft-fade in as the section enters (a one-shot outside the scrub),
 *     then each ring FILLS solid as the head passes it (inside the scrub, so
 *     scrolling back un-fills).
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

// ── Scroll binding (see header) ─────────────────────────────────────────────
// Timeline "seconds" above become scroll PROPORTIONS — the relative pacing
// (heading → draw → endnote) is unchanged, scroll just owns the playhead.
const PIN_START = "center center"; // stage centered; with the height-capped stage (timeline.tsx) the composition fits the viewport, the symmetric py padding hanging evenly off both edges
const PIN_DISTANCE = "+=200%"; // scroll length driving the draw while pinned
const PIN_HOLD = 0.6; // beat of dead scroll on the finished composition before the pin releases

export default function TimelineReveal() {
  useIsomorphicLayoutEffect(() => {
    const stage = document.querySelector<HTMLElement>("[data-tl-stage]");
    if (!stage) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;
    // Below md the stage is display:none and <TimelineMobile/> renders instead
    // (timeline.tsx). Everything past this point drives nodes that only exist
    // on the stage — the spine mask, the pen, the beat cards — and the pin
    // would be measuring a zero-height box, so bail exactly as reduced-motion
    // does and let the mobile layout stand in its resting (finished) state.
    // Keep this breakpoint in step with the `md:` in timeline.tsx.
    if (window.matchMedia(SMALL_SCREEN).matches) return;

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

    // The day-5 delivery badge is the one in-card element the SCRUBBED timeline
    // owns (it stamps as the draw-head reaches day 5), so it stays here. The
    // four infinite micro-loops live in timeline-micro.ts and are started at the
    // end of build() — they're keyed to no scroll position, so they had no
    // business being tangled up with the pin.
    const stampEl = stage.querySelector<HTMLElement>("[data-tl-stamp]");

    // ── LEAD-IN: extend the spine back to the viewport's left margin. ──
    // The height-capped stage is CENTERED (timeline.tsx), so a gutter opens on
    // its left. The line must still ORIGINATE at the viewport edge, so prepend
    // a straight segment along the path's start tangent (the path's first
    // command is already a straight 45° line, so the joint has no kink) to
    // BOTH the visible path and the mask brush, overshooting a few units so
    // the section's overflow-hidden trims it exactly at the edge. Rewriting
    // the `d` up front means everything downstream — total length, the draw
    // wipe, dot progress mapping, the pen's travel + rotation — treats the
    // lead-in as just more path. Skipped when the stage is full-bleed (no
    // gutter): the path's own start already bleeds off the stage edge.
    const visiblePath = stage.querySelector<SVGPathElement>("[data-tl-path]");
    const stageRect = stage.getBoundingClientRect();
    const frameScale = stageRect.width / FRAME_W; // uniform — the stage is aspect-locked
    if (visiblePath && stageRect.left > 1 && frameScale > 0) {
      const a = maskPath.getPointAtLength(0);
      const b = maskPath.getPointAtLength(8);
      const n = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / n;
      const uy = (b.y - a.y) / n;
      // Backtrack t along the tangent until the new start's SCREEN x passes
      // the viewport edge: stageLeft + (a.x + TX − t·ux)·scale = 0, +6 units.
      const t = (stageRect.left / frameScale + a.x + TX) / ux + 6;
      const head = PATH_D.match(/^M\s*(-?[\d.]+)[ ,](-?[\d.]+)/);
      if (ux > 0.1 && t > 0 && head) {
        const d =
          `M${(a.x - ux * t).toFixed(2)} ${(a.y - uy * t).toFixed(2)}` +
          `L${a.x.toFixed(2)} ${a.y.toFixed(2)}` +
          PATH_D.slice(head[0].length);
        maskPath.setAttribute("d", d);
        visiblePath.setAttribute("d", d);
      }
    }

    const L = maskPath.getTotalLength();
    const toPct = (fx: number, fy: number) => ({
      x: (fx / FRAME_W) * 100,
      y: (fy / FRAME_H) * 100,
    });

    // Pen foot offset: measure the mark's finished resting box (its foot on the
    // terminus, hand-tuned in timeline.tsx) and subtract the geometric terminus,
    // so the travel lands p=1 back on that exact spot — no magic numbers here.
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
    // Checkpoints park as HOLLOW RINGS: fully invisible until the on-enter
    // ring fade, and unfilled until the draw-head passes (the fill tween
    // lives in the scrubbed timeline).
    gsap.set(dots.map((d) => d.el), { autoAlpha: 0, fillOpacity: 0 });
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
    // The day-5 badge parks hidden (reduced-motion returned above, so the
    // finished-state markup stays put there). The four micro-loops park their
    // own targets in timeline-micro.ts.
    if (stampEl) gsap.set(stampEl, { autoAlpha: 0, scale: 0.6 });

    let ctx: gsap.Context | undefined;
    let split: SplitText | undefined;
    let stopMicro: (() => void) | undefined;
    let cancelled = false;

    const build = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        // SCRUBBED master timeline — scroll owns the playhead. We pin the whole
        // <section> (not the stage) so the section's vertical padding rides
        // along. pinSpacing must be set EXPLICITLY: the sections are direct
        // children of the flex-column <body> (layout.tsx), and ScrollTrigger
        // silently defaults pinSpacing to false inside flex parents — which let
        // the next section scroll straight over the pinned stage.
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: stage.closest<HTMLElement>("[data-timeline]") ?? stage,
            start: PIN_START,
            end: PIN_DISTANCE,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
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

        // The checkpoint RINGS soft-fade in as the section enters — a one-shot
        // OUTSIDE the scrub (its own once-trigger), so the route's unfilled
        // checkpoints are already visible before the pin engages and the draw
        // begins. A gentle path-order stagger.
        gsap.fromTo(
          dots.map((d) => d.el),
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: 0.8,
            ease: "power2.out",
            stagger: 0.06,
            scrollTrigger: { trigger: stage, start: "top 80%", once: true },
          },
        );

        // Each checkpoint FILLS as the head passes it (placed via the ease
        // inverse): fill-opacity 0→1 in place — the hollow ring banks solid.
        // Lives in the scrubbed timeline, so scrolling back un-fills it.
        for (const d of dots) {
          tl.fromTo(
            d.el,
            { fillOpacity: 0 },
            { fillOpacity: 1, duration: 0.45, ease: "power2.out" },
            timeForP(d.p),
          );
        }

        // Each day's content is COMPLETELY revealed the moment the head
        // reaches its checkpoint, and the anticipation window is SPATIAL, not
        // temporal: the bloom spans the head's travel across the last
        // REVEAL_LEAD fraction of the path before the dot (both edges mapped
        // through the ease inverse). A fixed time-lead was wrong here — under
        // power1.inOut a constant 0.6 was ~a quarter of the whole draw, so
        // far-away cards bloomed while the pen was still checkpoints away.
        // Spatially the window always hugs the pen: bloom starts as the head
        // closes in, fully sharp on touch.
        // power2.inOut (not the house power3.out): the out-ease front-loads
        // the motion so the rise felt rushed inside the short window; inOut
        // spends the window evenly — a gentle build, a gentle settle.
        const REVEAL_LEAD = 0.05; // path fraction before a dot over which its card blooms
        for (const r of cardReveals) {
          const end = timeForP(r.p);
          const start = timeForP(Math.max(0, r.p - REVEAL_LEAD));
          tl.fromTo(
            r.el,
            { autoAlpha: 0, y: 16, filter: "blur(8px)" },
            {
              autoAlpha: 1,
              y: 0,
              filter: "blur(0px)",
              duration: Math.max(0.15, end - start),
              ease: "power2.inOut",
              clearProps: "filter",
            },
            start,
          );
        }

        // ── In-card micro-animations, each keyed to its day's reveal moment. ──

        // day-5: the delivery ✓ badge stamps onto the design — same spatial
        // window as the cards (a shorter one), fully landed on touch.
        if (stampEl) {
          const pDelivery = pByBeat.get("delivery");
          const end = beatTime("delivery");
          const start =
            pDelivery == null
              ? end - 0.2
              : timeForP(Math.max(0, pDelivery - REVEAL_LEAD / 2));
          tl.fromTo(
            stampEl,
            { autoAlpha: 0, scale: 0.6 },
            {
              autoAlpha: 1,
              scale: 1,
              duration: Math.max(0.1, end - start),
              ease: "back.out(1.8)",
            },
            Math.max(0, start),
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

        // A beat of dead scroll on the finished composition, so the pin doesn't
        // release the instant the pen lands.
        tl.to({}, { duration: PIN_HOLD }, DRAW_AT + DRAW_DURATION);
      }, stage);

      // The four in-card infinite loops (timeline-micro.ts). Started here, after
      // fonts.ready, because the progress chip MEASURES both of its labels to
      // tween its own width between them — measuring against a fallback face
      // pins the chip to the wrong size for the session.
      stopMicro = initTimelineMicro(stage);

      // The pin's spacer pushes everything below the section down. The other
      // sections' triggers also build behind fonts.ready in their own effects
      // (order not guaranteed), so any built before this one measured the
      // un-spaced layout — re-measure them all once the pin exists.
      ScrollTrigger.refresh();
    };

    // Defer until fonts are ready so SplitText measures real glyph metrics.
    if (!document.fonts || document.fonts.status === "loaded") build();
    else document.fonts.ready.then(build);

    return () => {
      cancelled = true;
      stopMicro?.();
      ctx?.revert();
      split?.revert();
      // Drop the synchronous parks so the finished layout shows if we never built.
      // Restore the un-extended path (the lead-in rewrite, if it happened).
      maskPath.setAttribute("d", PATH_D);
      visiblePath?.setAttribute("d", PATH_D);
      maskPath.style.removeProperty("stroke-dashoffset");
      pen.style.removeProperty("left");
      pen.style.removeProperty("top");
      gsap.set(pen, { clearProps: "opacity,visibility,transform,transformOrigin" });
      gsap.set(dots.map((d) => d.el), {
        clearProps: "transform,opacity,visibility,fillOpacity",
      });
      gsap.set(hidden, { clearProps: "opacity,visibility,transform,filter" });
      // The day-5 badge back to its resting markup; the micro-loops' own targets
      // are restored by stopMicro() above.
      if (stampEl) gsap.set(stampEl, { clearProps: "opacity,visibility,transform" });
    };
  }, []);

  return null;
}

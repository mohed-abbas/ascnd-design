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
 * "your first month, plotted" scroll reveal. One-shot on enter, using the SAME
 * draw mechanism + pacing as the home page's "simple pricing" connector
 * (pricing-reveal.tsx / pricing-icons.tsx): a fat solid brush masks the dotted
 * spine and its strokeDashoffset wipes 1→0 (power1.inOut) so the line draws on
 * smoothly — no per-frame length maths, no "racing" head.
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
 * Renders nothing — drives the [data-tl-*] / [data-timeline-*] nodes in
 * timeline.tsx. House rules: rides GSAP's shared ticker (LenisProvider); a
 * single `once: true` timeline (idles to zero); SSR / no-JS / reduced-motion
 * render the FINISHED composition (spine drawn, cards + dots shown), hidden only
 * once we know we'll animate.
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

export default function TimelineReveal() {
  useIsomorphicLayoutEffect(() => {
    const stage = document.querySelector<HTMLElement>("[data-tl-stage]");
    if (!stage) return;
    if (window.matchMedia(REDUCE_MOTION).matches) return;

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
    const countEl = stage.querySelector<HTMLElement>("[data-tl-count]");
    const stampEl = stage.querySelector<HTMLElement>("[data-tl-stamp]");
    const cellEls = gsap.utils.toArray<HTMLElement>(
      stage.querySelectorAll("[data-tl-cell]"),
    );
    const refreshSpin = stage.querySelector<SVGElement>("[data-tl-refresh-spin]");
    const refreshCheck = stage.querySelector<SVGElement>("[data-tl-refresh-check]");
    const refreshAura = stage.querySelector<HTMLElement>("[data-tl-refresh-aura]");

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
    const hidden = [sub, endnote, ...cardReveals.map((r) => r.el)].filter(
      (el): el is HTMLElement => el != null,
    );
    gsap.set(hidden, { autoAlpha: 0 });
    gsap.set(dots.map((d) => d.el), { autoAlpha: 0 });
    maskPath.style.strokeDashoffset = "1"; // spine empty
    gsap.set(pen, { autoAlpha: 0 });
    const startPt = maskPath.getPointAtLength(0);
    const startPct = toPct(startPt.x + TX, startPt.y + TY);
    pen.style.left = `${startPct.x + footOffX}%`;
    pen.style.top = `${startPct.y + footOffY}%`;
    // Micro-animation resets (reduced-motion returned above, so finished-state
    // markup stays put there). The refresh tick + aura are hidden via class.
    if (countEl) countEl.textContent = "0";
    if (cellEls.length) gsap.set(cellEls, { autoAlpha: 0 });
    if (stampEl) gsap.set(stampEl, { autoAlpha: 0, scale: 0.6 });

    let ctx: gsap.Context | undefined;
    let split: SplitText | undefined;
    let cancelled = false;

    const build = () => {
      if (cancelled) return;
      ctx = gsap.context(() => {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: stage, start: "top 75%", once: true },
        });

        // Heading words blur-rise (SplitText), sub a beat later.
        if (heading) {
          split = new SplitText(heading, { type: "words" });
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
        // head each frame (drawn fraction p = 1 − o → getPointAtLength(p·L)).
        const draw = { o: 1 };
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

        // day-2: the "70% completed" chip counts up 0→70.
        if (countEl) {
          const target = Number(countEl.dataset.countTo ?? 70);
          const n = { v: 0 };
          tl.to(
            n,
            {
              v: target,
              duration: 1.1,
              ease: "power1.out",
              onUpdate: () => {
                countEl.textContent = String(Math.round(n.v));
              },
            },
            beatTime("first-request") + 0.1,
          );
        }

        // day-5: the delivery ✓ badge stamps onto the design.
        if (stampEl) {
          tl.fromTo(
            stampEl,
            { autoAlpha: 0, scale: 0.6 },
            { autoAlpha: 1, scale: 1, duration: 0.4, ease: "back.out(1.8)" },
            beatTime("delivery") + 0.3,
          );
        }

        // day-12: the refresh spins "in progress" ~2s, then cross-fades to a green
        // tick as the rainbow aura ignites — the work landing "done".
        if (refreshSpin && refreshCheck) {
          const spinAt = beatTime("revised");
          const swapAt = spinAt + 2.0;
          tl.to(refreshSpin, { rotation: "+=720", duration: 2.0, ease: "none" }, spinAt);
          tl.to(refreshSpin, { autoAlpha: 0, duration: 0.2 }, swapAt);
          tl.fromTo(
            refreshCheck,
            { autoAlpha: 0, scale: 0.5 },
            { autoAlpha: 1, scale: 1, duration: 0.4, ease: "back.out(2)" },
            swapAt,
          );
          if (refreshAura) {
            tl.to(refreshAura, { autoAlpha: 1, duration: 0.4 }, swapAt);
          }
        }

        // day-23: the banked-calendar cells fill in with a staggered fade (no move).
        if (cellEls.length) {
          tl.to(
            cellEls,
            { autoAlpha: 1, duration: 0.35, ease: "power1.out", stagger: 0.025 },
            beatTime("pause") + 0.15,
          );
        }

        // Endnote settles as the pen lands.
        if (endnote) {
          tl.fromTo(
            endnote,
            { autoAlpha: 0, y: 6 },
            { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" },
            DRAW_AT + DRAW_DURATION - 0.35,
          );
        }
      }, stage);
    };

    // Defer until fonts are ready so SplitText measures real glyph metrics.
    if (!document.fonts || document.fonts.status === "loaded") build();
    else document.fonts.ready.then(build);

    return () => {
      cancelled = true;
      ctx?.revert();
      split?.revert();
      // Drop the synchronous parks so the finished layout shows if we never built.
      maskPath.style.removeProperty("stroke-dashoffset");
      pen.style.removeProperty("left");
      pen.style.removeProperty("top");
      gsap.set(pen, { clearProps: "opacity,visibility" });
      gsap.set(dots.map((d) => d.el), { clearProps: "transform,opacity,visibility" });
      gsap.set(hidden, { clearProps: "opacity,visibility,transform,filter" });
      // Restore the micro-animation targets (opacity clears revert the tick/aura
      // to their class-hidden state; count returns to its final value).
      if (countEl) countEl.textContent = countEl.dataset.countTo ?? "70";
      const micro = [stampEl, refreshSpin, refreshCheck, refreshAura, ...cellEls].filter(
        (el): el is HTMLElement | SVGElement => el != null,
      );
      if (micro.length) gsap.set(micro, { clearProps: "opacity,visibility,transform" });
    };
  }, []);

  return null;
}

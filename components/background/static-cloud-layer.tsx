"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMode } from "@/lib/theme/use-mode";
import { CROSSFADE, PALETTES } from "@/lib/theme/palette";
import {
  DEFAULT_FLOW,
  DEFAULT_TRAVEL,
  type StaticCloudSpec,
} from "./static-cloud-specs";

/**
 * Static-sprite cloud layer — the mobile / reduced-motion / no-WebGL stand-in
 * for the volumetric CloudCanvas. Renders the STATIC_CLOUDS spec
 * (static-cloud-specs.ts — the tuning surface) as plain positioned <img>
 * sprites in the SAME two fixed strata as the live clouds (sky behind content,
 * front above the rock bases) and reproduces their scroll motion:
 *
 *  - FIELD clouds translate with the page (speed 1 = welded, < 1 = damped
 *    depth parallax) — ScrollAnchorRig in DOM.
 *  - SECTION clouds drift across their section's viewport crossing: `travel`
 *    vh below rest (entering) through rest (centred) to above (leaving) —
 *    SectionRig's "Option B", with `swell` as the perspective stand-in.
 *  - PIN clouds convey across a pinned section's full scroll span (why-stay).
 *
 * TWO DRIVE PATHS. Mobile scrolling is asynchronous — the compositor pans the
 * page off-main-thread while JS-applied transforms land a frame (or more)
 * late, so ScrollTrigger-driven sprites visibly step during medium/fast
 * flings and update at half rate under Low Power Mode's rAF throttle. Where
 * the browser supports CSS scroll-driven animations, field and section clouds
 * are therefore driven ENTIRELY on the compositor:
 *
 *  - FIELD → `animation-timeline: scroll(root)` over a fixed 0–FIELD_RANGE_PX
 *    range with a `to` keyframe of −range·speed px, which resolves to
 *    y = −scroll·speed exactly, independent of document height.
 *  - SECTION → a named `view-timeline` stamped on the section element (hoisted
 *    to the fixed sprites via `timeline-scope` on <body>); the default `cover`
 *    range IS ScrollTrigger's "top bottom"→"bottom top", and linear keyframes
 *    between the drift's endpoints reproduce the y/scale math. (`swell` scale
 *    interpolates linearly instead of exponentially — <0.5% off at the 1.1
 *    swells in use.) `fill: both` parks off-range clouds exactly like the JS
 *    path's seeding.
 *
 * PIN clouds always stay on the GSAP path: their span is one viewport of
 * entrance + the pin's extra scroll + the exit, which no view() timeline can
 * express (the section doesn't move while pinned, so its view timeline would
 * stall mid-pin). Browsers without scroll-timeline support (older iOS) keep
 * the full GSAP path for everything — identical to the pre-port behavior.
 *
 * Theme tint: the sprites are baked day-lit, so each <img> carries the current
 * mode's `cloud.cssFilter` (palette.ts) with a CROSSFADE-matched transition —
 * the CSS approximation of ThemeRig's light tween. The filter sits on the
 * imgs, never on a fixed ancestor (the fixed-positioning constraint). The
 * scroll animation targets `transform` only, so it composes with the filter.
 *
 * Not a heavy effect: no canvas, no rAF loop — compositor animations plus
 * (fallback/pin only) transform updates on the shared GSAP/ScrollTrigger
 * pipeline, zero main-thread work while scroll is idle.
 */

// Fixed scroll span the field clouds' scroll(root) timeline is mapped over.
// Must exceed the page's max scroll on any device (mobile page ≈ 15k px);
// headroom is free — a longer range just leaves the tail of the keyframe
// unused, the px-per-scroll slope is range-independent.
const FIELD_RANGE_PX = 40000;

// Both features ship together in practice, but the sprites need view() AND
// the <body> timeline-scope hoist — probe for each so a partial
// implementation falls back to the GSAP path instead of half-working.
const canUseScrollTimeline = () =>
  typeof CSS !== "undefined" &&
  CSS.supports("animation-timeline: view()") &&
  CSS.supports("timeline-scope: --t");

/**
 * The viewport height the CONTENT is laid out against: `100svh`, the SMALL
 * viewport — the one with the mobile browser chrome expanded. Constant for the
 * life of an orientation.
 *
 * `window.innerHeight` is not that. It tracks the URL bar, and every cloud
 * offset here is a multiple of it (`flow` and `travel` are expressed in vh), so
 * re-reading it re-scaled the whole sky's drift the moment the bar moved: with
 * a flow of ~500 a 10% viewport change is ~0.5vh of instant jump. The sections
 * stopped doing this when they moved to `svh`; the clouds kept doing it in JS,
 * which is why they were the only thing left stepping.
 *
 * Measured from a probe because there is no `window.smallViewportHeight` to ask.
 * One forced layout per call, and it's called on mount and on refresh only —
 * never per scroll update. Falls back to innerHeight if `svh` is unsupported
 * (nothing in the browserslist target is, but the probe returning 0 shouldn't
 * park every cloud at the origin).
 */
function stableViewportHeight(): number {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none";
  document.documentElement.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return h || window.innerHeight;
}

// "[data-cards]" → "--sct-data-cards" — one named timeline per section.
const timelineName = (selector: string) =>
  `--sct-${selector.replace(/[^a-zA-Z0-9-]/g, "")}`;

/**
 * Bake the compositor path's stylesheet from STATIC_CLOUDS: one @keyframes +
 * one class per non-pin cloud. Generated (rather than var()-in-keyframes) so
 * every animation is a plain literal transform tween the compositor is
 * guaranteed to run off-main-thread.
 */
/**
 * Compositor rules for the PIN clouds — measured, so this cannot be a pure
 * function of the spec like the one below.
 *
 * These were the last sprites left on the main thread, and on a phone they were
 * the worst thing on the page: `position: fixed` elements whose `y` is written
 * from a scroll handler while the page itself pans on the compositor. At
 * walking pace the lag is a pixel or two and invisible; in a fling the browser
 * coalesces scroll events down to ~10–15Hz, so the clouds visibly STEP at that
 * rate against a perfectly smooth page. Reported, accurately, as "they feel
 * like they're at less than 10fps when I scroll fast".
 *
 * The file's original reasoning for keeping them on GSAP is sound as far as it
 * goes: their span is entrance + pin + exit, and a `view()` timeline on the
 * section would stall mid-pin because a pinned section stops moving. But that
 * argument only rules out view() — and it turns out nothing here needs it. The
 * GSAP formula is
 *
 *     y = (pAt − progress) × flow × vh / 100 ,  progress = (scroll − start) / total
 *
 * which is LINEAR IN SCROLL. So it is exactly a field cloud with a computed
 * slope and a non-zero offset, and `scroll(root)` — the same primitive the
 * field clouds already run on, off the main thread, at any scroll speed —
 * expresses it perfectly:
 *
 *     y(progress) = (pAt − progress) × flow × vh / 100
 *
 * so the two endpoints are simply progress 0 and progress 1, and
 * `animation-range: <start>px <end>px` places them at the same scroll offsets
 * the trigger used.
 *
 * ⚠️ THE RANGE IS LOAD-BEARING, not a detail. A ScrollTrigger is BOUNDED — past
 * its end the tween holds its final value. Mapping these to the field clouds'
 * open 0–FIELD_RANGE_PX range instead (the first version of this) let them keep
 * drifting across the whole document at ~1.1px per px of scroll, so the
 * why-stay clouds sailed up into working-with and appeared there as a second
 * set of clouds on top of its own two. `animation-range` + `fill: both` clamps
 * outside the span exactly as the trigger did.
 *
 * `start` and `total` are layout-dependent, so this is recomputed whenever
 * ScrollTrigger refreshes (see the effect below).
 */
function buildPinTimelineCss(clouds: StaticCloudSpec[]): string {
  const rules: string[] = [];
  const vh = stableViewportHeight();
  for (const c of clouds) {
    if (!c.pin || !c.trigger) continue;
    const section = document.querySelector<HTMLElement>(c.trigger);
    if (!section) continue;

    const { extra, at } = c.pin;
    const flow = c.flow ?? DEFAULT_FLOW;

    // ⚠️ MEASURE THE PIN-SPACER, NEVER THE SECTION.
    // ScrollTrigger pins by setting the section to `position: fixed` and
    // leaving a `.pin-spacer` behind to hold its place in flow. A fixed
    // element's getBoundingClientRect() is viewport-relative, so the usual
    // `rect.top + scrollY` idiom does NOT give its document position while the
    // pin is engaged — it drifts by however far into the pin you are, measured
    // at up to ~2100px here (the full pin distance).
    //
    // That matters because this runs on every ScrollTrigger.refresh(), and a
    // refresh can perfectly well land while the visitor is inside the pin. When
    // it did, `start` was overstated, the whole range slid down the page past
    // pills, and the why-stay clouds were still mid-drift over working-with —
    // showing up there as a second set of clouds on top of its own two. Which
    // is precisely the "clouds double when I scroll back up" report.
    //
    // The spacer is never fixed and never moves, so it is always safe to
    // measure. Its height already includes the pin distance, so it also gives
    // `total` without having to re-add `extra`.
    const spacer =
      section.parentElement?.classList.contains("pin-spacer")
        ? section.parentElement
        : null;
    const box = spacer ?? section;
    const total = vh + (spacer ? spacer.offsetHeight : extra + section.offsetHeight);
    const pAt = (vh + at * extra) / total;
    // Document offset at which the GSAP trigger's "top bottom" start fires.
    const start = box.getBoundingClientRect().top + window.scrollY - vh;

    // progress 0 → 1 over exactly [start, start + total], matching the trigger.
    const y0 = (pAt * flow * vh) / 100;
    const y1 = ((pAt - 1) * flow * vh) / 100;

    rules.push(
      `@keyframes sc-${c.key} { from { transform: translateY(${y0.toFixed(1)}px); } to { transform: translateY(${y1.toFixed(1)}px); } }`,
      // ⚠️ shorthand first — `animation:` resets timeline/range longhands.
      `.sc-${c.key} { animation: sc-${c.key} 1ms linear both; animation-timeline: scroll(root); animation-range: ${start.toFixed(0)}px ${(start + total).toFixed(0)}px; }`,
    );
  }
  return rules.join("\n");
}

function buildScrollTimelineCss(clouds: StaticCloudSpec[]): string {
  const rules: string[] = [];
  for (const c of clouds) {
    if (c.pin) continue;
    if (!c.trigger) {
      const shift = (-FIELD_RANGE_PX * (c.speed ?? 1)).toFixed(0);
      rules.push(
        `@keyframes sc-${c.key} { to { transform: translateY(${shift}px); } }`,
        // ⚠️ shorthand first: `animation:` resets animation-timeline/range,
        // so the longhands must follow it.
        `.sc-${c.key} { animation: sc-${c.key} 1ms linear both; animation-timeline: scroll(root); animation-range: 0px ${FIELD_RANGE_PX}px; }`,
      );
      continue;
    }
    // Drift endpoints: d = 2·(progress − at) evaluated at progress 0 and 1,
    // y = −d·travel vh, scale = swell^d — the SectionRig math, linearized.
    const at = c.at ?? 0.5;
    const travel = c.travel ?? DEFAULT_TRAVEL;
    const swell = c.swell ?? 1;
    const y = (d: number) => (-d * travel).toFixed(2);
    const s = (d: number) => Math.pow(swell, d).toFixed(4);
    const d0 = -2 * at;
    const d1 = 2 * (1 - at);
    rules.push(
      `@keyframes sc-${c.key} { from { transform: translateY(${y(d0)}svh) scale(${s(d0)}); } to { transform: translateY(${y(d1)}svh) scale(${s(d1)}); } }`,
      `.sc-${c.key} { animation: sc-${c.key} 1ms linear both; animation-timeline: ${timelineName(c.trigger)}; }`,
    );
  }
  return rules.join("\n");
}

export default function StaticCloudLayer({
  clouds,
  reveal,
}: {
  /** The route's static-cloud set (static-cloud-specs.ts staticCloudsForPath). */
  clouds: StaticCloudSpec[];
  /** Intro fade/settle style from cloud-layer.tsx — applied per layer. */
  reveal: React.CSSProperties;
}) {
  const mode = useMode();
  const imgRefs = useRef<Map<string, HTMLImageElement>>(new Map());
  // Decided once at mount. Safe to probe here: cloud-layer.tsx renders this
  // component only after hydration (its `hydrated` gate), so there is no SSR
  // pass to keep consistent with.
  const [compositor] = useState(canUseScrollTimeline);
  const css = useMemo(
    () => (compositor ? buildScrollTimelineCss(clouds) : ""),
    [compositor, clouds],
  );
  // Pin-cloud rules are MEASURED, so unlike the static rules above they live in
  // state and are rebuilt whenever the layout they were measured against moves.
  const [pinCss, setPinCss] = useState("");

  // ——— Compositor wiring: name each section's view timeline and hoist the
  // names to <body> so the fixed sprites (not descendants of the sections)
  // can reference them. Inline styles, restored on unmount.
  useEffect(() => {
    if (!compositor) return;
    const tagged: HTMLElement[] = [];
    const names: string[] = [];
    const selectors = new Set(
      clouds.filter((c) => c.trigger && !c.pin).map((c) => c.trigger!),
    );
    for (const sel of selectors) {
      const section = document.querySelector<HTMLElement>(sel);
      if (!section) continue;
      const name = timelineName(sel);
      section.style.setProperty("view-timeline-name", name);
      tagged.push(section);
      names.push(name);
    }
    document.body.style.setProperty("timeline-scope", names.join(", "));
    return () => {
      tagged.forEach((s) => s.style.removeProperty("view-timeline-name"));
      document.body.style.removeProperty("timeline-scope");
    };
  }, [compositor, clouds]);

  // ——— Pin clouds on the compositor: measure, then re-measure whenever the
  // page geometry they were derived from changes. ScrollTrigger.refresh() is
  // the right signal (the pin itself re-measures there, and lenis-provider
  // already debounces it behind a DOM-height watchdog), plus an orientation /
  // real-resize pass. Deliberately NOT hooked to plain scroll: the whole point
  // is that scrolling touches nothing here.
  useEffect(() => {
    if (!compositor) return;
    if (!clouds.some((c) => c.pin)) return;
    gsap.registerPlugin(ScrollTrigger);
    const rebuild = () => setPinCss(buildPinTimelineCss(clouds));
    rebuild();
    ScrollTrigger.addEventListener("refresh", rebuild);
    window.addEventListener("resize", rebuild);
    return () => {
      ScrollTrigger.removeEventListener("refresh", rebuild);
      window.removeEventListener("resize", rebuild);
    };
  }, [compositor, clouds]);

  // ——— GSAP path: everything on fallback browsers; pin clouds always. ———
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const triggers: ScrollTrigger[] = [];
    let onRefresh: (() => void) | null = null;

    if (!compositor) {
      // FIELD clouds: one trigger, per-cloud damped page tracking.
      const setters = clouds.filter((c) => !c.trigger)
        .map((c) => {
          const el = imgRefs.current.get(c.key);
          return el ? { speed: c.speed ?? 1, set: gsap.quickSetter(el, "y", "px") } : null;
        })
        .filter((s) => s !== null);
      const applyField = (scroll: number) => {
        for (const s of setters) s.set(-scroll * s.speed);
      };
      const fieldSt = ScrollTrigger.create({
        start: 0,
        end: "max",
        scrub: true,
        onUpdate: (self) => applyField(self.scroll()),
      });
      triggers.push(fieldSt);
      // Seed a load that restores mid-page (scrub fires lazily), and re-seed
      // after every refresh — ScrollTrigger.refresh() reverts the scroller to 0
      // to measure, which runs the scrub with scroll=0 and would otherwise leave
      // the field snapped to its hero rest until the next real scroll (same
      // failure ScrollAnchorRig guards against in cloud-canvas.tsx).
      applyField(window.scrollY || 0);
      onRefresh = () => applyField(fieldSt.scroll());
      ScrollTrigger.addEventListener("refresh", onRefresh);
    }

    // SECTION + PIN clouds — fallback browsers only now. Pin clouds used to be
    // unconditional here ("no view() timeline can express a pinned span"), but
    // they run on scroll(root) instead (buildPinTimelineCss), so where the
    // compositor path exists it owns every cloud and this loop does nothing.
    for (const c of clouds) {
      if (!c.trigger) continue;
      if (compositor) continue;
      const section = document.querySelector<HTMLElement>(c.trigger);
      const el = imgRefs.current.get(c.key);
      if (!section || !el) continue;

      // Viewport height, captured per refresh instead of read per update, and
      // read as the STABLE small viewport rather than innerHeight.
      //
      // Capturing per refresh was the first half of this fix: innerHeight
      // changing mid-fling made the drift amplitude wobble during the very
      // scroll it was sampled in. But it only reduced the frequency of the
      // problem — the value was still a URL-bar-dependent one, so every refresh
      // re-scaled the whole sky and the clouds stepped. stableViewportHeight()
      // removes the dependency instead of re-sampling it, and matches the unit
      // the sections themselves are now laid out in.
      let vh = stableViewportHeight();

      if (c.pin) {
        // The element's viewport crossing understates a pinned section's real
        // scroll span, so drive across entrance + pin + exit explicitly:
        // start at "top bottom", end a start-relative `+=` of one viewport
        // (entrance) + the pin's extra scroll + the section height (exit) —
        // immune to pin-spacer layout shifts. The cloud rests at (x, y) when
        // overall progress hits its option's spot (pin.at remapped from pin
        // progress to the full span) and otherwise drifts linearly, `flow` vh
        // over the whole span — all clouds sharing a flow form an evenly
        // spaced streak.
        const { extra, at } = c.pin;
        const flow = c.flow ?? DEFAULT_FLOW;
        const apply = (self: ScrollTrigger) => {
          const total = vh + extra + section.offsetHeight;
          const pAt = (vh + at * extra) / total;
          gsap.set(el, { y: ((pAt - self.progress) * flow * vh) / 100 });
        };
        const st = ScrollTrigger.create({
          trigger: section,
          start: "top bottom",
          end: () => `+=${vh + extra + section.offsetHeight}`,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: apply,
          onRefresh: (self) => {
            vh = stableViewportHeight();
            apply(self);
          },
        });
        triggers.push(st);
        apply(st); // seed (parks pAt × flow vh below rest while down-page)
        continue;
      }

      const apply = (self: ScrollTrigger) => {
        // d: below rest → 0 at rest (crossing progress = `at`, default the
        // section centre) → above rest. [-1, 1] for a centred cloud.
        const d = 2 * (self.progress - (c.at ?? 0.5));
        gsap.set(el, {
          y: (-d * (c.travel ?? DEFAULT_TRAVEL) * vh) / 100,
          scale: c.swell && c.swell !== 1 ? Math.pow(c.swell, d) : 1,
        });
      };
      const st = ScrollTrigger.create({
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: apply,
        onRefresh: (self) => {
          vh = stableViewportHeight();
          apply(self);
        },
      });
      triggers.push(st);
      apply(st); // seed (parks below rest while the section is down-page)
    }

    return () => {
      if (onRefresh) ScrollTrigger.removeEventListener("refresh", onRefresh);
      triggers.forEach((t) => t.kill());
    };
  }, [compositor, clouds]);

  // Mode retint — on the <img>s themselves (a filter on the fixed layer would
  // be an ancestor filter). Transition mirrors the live clouds' CROSSFADE.
  const imgStyle: React.CSSProperties = {
    filter: PALETTES[mode].cloud.cssFilter,
    transition: `filter ${CROSSFADE.duration}s ease-in-out`,
    willChange: "transform",
  };

  const renderClouds = (layer: StaticCloudSpec["layer"]) =>
    clouds.filter((c) => c.layer === layer).map((c) => (
      <div
        key={c.key}
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${c.x}vw`,
          top: `${c.y}vh`,
          width: `${c.width}vw`,
          opacity: c.opacity,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- pre-baked,
            pre-sized transparent WebP sprites; the optimizer would only
            re-encode them and its wrapper would fight the GSAP transform. */}
        <img
          ref={(el) => {
            if (el) imgRefs.current.set(c.key, el);
            else imgRefs.current.delete(c.key);
          }}
          src={`/clouds/sprites/${c.sprite}`}
          alt=""
          draggable={false}
          decoding="async"
          className={compositor ? `w-full sc-${c.key}` : "w-full"}
          style={imgStyle}
        />
      </div>
    ));

  // Same stacking as the live canvases (cloud-layer.tsx): sky behind the page
  // content, front above the rock bases / intro canvas.
  return (
    <>
      {compositor && <style>{`${css}\n${pinCss}`}</style>}
      <div aria-hidden style={reveal} className="pointer-events-none fixed inset-0 -z-10">
        {renderClouds("sky")}
      </div>
      <div aria-hidden style={reveal} className="pointer-events-none fixed inset-0 z-[61]">
        {renderClouds("front")}
      </div>
    </>
  );
}

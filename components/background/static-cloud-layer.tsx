"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMode } from "@/lib/theme/use-mode";
import { CROSSFADE, PALETTES } from "@/lib/theme/palette";
import {
  DEFAULT_FLOW,
  DEFAULT_TRAVEL,
  STATIC_CLOUDS,
  type StaticCloudSpec,
} from "./static-cloud-specs";

/**
 * Static-sprite cloud layer — the mobile / reduced-motion / no-WebGL stand-in
 * for the volumetric CloudCanvas. Renders the STATIC_CLOUDS spec
 * (static-cloud-specs.ts — the tuning surface) as plain positioned <img>
 * sprites in the SAME two fixed strata as the live clouds (sky behind content,
 * front above the rock bases) and reproduces their scroll motion in DOM:
 *
 *  - FIELD clouds ride one scrubbed ScrollTrigger translating them with the
 *    page (speed 1 = welded, < 1 = damped depth parallax) — ScrollAnchorRig
 *    in DOM, including the refresh re-seed.
 *  - SECTION clouds each get a scrubbed trigger on their section: a linear
 *    drift from `travel` vh below rest (section entering) through rest
 *    (section centred) to `travel` vh above (leaving) — SectionRig's
 *    "Option B", with `swell` as the perspective stand-in (scale swell^d).
 *
 * Theme tint: the sprites are baked day-lit, so each <img> carries the current
 * mode's `cloud.cssFilter` (palette.ts) with a CROSSFADE-matched transition —
 * the CSS approximation of ThemeRig's light tween. The filter sits on the
 * imgs, never on a fixed ancestor (the fixed-positioning constraint).
 *
 * Not a heavy effect: no canvas, no rAF loop — transform-only updates driven
 * by the shared GSAP/ScrollTrigger pipeline, zero work while scroll is idle.
 */

export default function StaticCloudLayer({
  reveal,
}: {
  /** Intro fade/settle style from cloud-layer.tsx — applied per layer. */
  reveal: React.CSSProperties;
}) {
  const mode = useMode();
  const imgRefs = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const triggers: ScrollTrigger[] = [];

    // ——— FIELD clouds: one trigger, per-cloud damped page tracking. ———
    const setters = STATIC_CLOUDS.filter((c) => !c.trigger)
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
    const onRefresh = () => applyField(fieldSt.scroll());
    ScrollTrigger.addEventListener("refresh", onRefresh);

    // ——— SECTION clouds: linear drift across their section's crossing. ———
    // ——— PIN clouds: conveyor across a pinned section's full scroll span. ———
    for (const c of STATIC_CLOUDS) {
      if (!c.trigger) continue;
      const section = document.querySelector<HTMLElement>(c.trigger);
      const el = imgRefs.current.get(c.key);
      if (!section || !el) continue;

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
          const vh = window.innerHeight;
          const total = vh + extra + section.offsetHeight;
          const pAt = (vh + at * extra) / total;
          gsap.set(el, { y: ((pAt - self.progress) * flow * vh) / 100 });
        };
        const st = ScrollTrigger.create({
          trigger: section,
          start: "top bottom",
          end: () => `+=${window.innerHeight + extra + section.offsetHeight}`,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: apply,
          onRefresh: apply,
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
          y: (-d * (c.travel ?? DEFAULT_TRAVEL) * window.innerHeight) / 100,
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
        onRefresh: apply,
      });
      triggers.push(st);
      apply(st); // seed (parks below rest while the section is down-page)
    }

    return () => {
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      triggers.forEach((t) => t.kill());
    };
  }, []);

  // Mode retint — on the <img>s themselves (a filter on the fixed layer would
  // be an ancestor filter). Transition mirrors the live clouds' CROSSFADE.
  const imgStyle: React.CSSProperties = {
    filter: PALETTES[mode].cloud.cssFilter,
    transition: `filter ${CROSSFADE.duration}s ease-in-out`,
    willChange: "transform",
  };

  const renderClouds = (layer: StaticCloudSpec["layer"]) =>
    STATIC_CLOUDS.filter((c) => c.layer === layer).map((c) => (
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
          className="w-full"
          style={imgStyle}
        />
      </div>
    ));

  // Same stacking as the live canvases (cloud-layer.tsx): sky behind the page
  // content, front above the rock bases / intro canvas.
  return (
    <>
      <div aria-hidden style={reveal} className="pointer-events-none fixed inset-0 -z-10">
        {renderClouds("sky")}
      </div>
      <div aria-hidden style={reveal} className="pointer-events-none fixed inset-0 z-[61]">
        {renderClouds("front")}
      </div>
    </>
  );
}

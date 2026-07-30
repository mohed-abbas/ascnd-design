"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { getMode, setMode } from "@/lib/theme/mode-store";
import { useMode } from "@/lib/theme/use-mode";
import { THEME_MODES, type ThemeMode } from "@/lib/theme/palette";
import { MoonIcon, SunIcon, SunriseIcon, SunsetIcon } from "./icons";
import { registerAbsorbable } from "./menu-absorb";

// See sliding-highlight.tsx for why this pair exists.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** The cross-fade. Short — this is a button, not a scene transition. */
const FADE = 0.28;
const FADE_EASE = "power2.out";

/** The ray pop: overshoot on the way out, so each line springs past 1 and back. */
const POP = 0.4;
const POP_EASE = "back.out(3)";
const POP_STAGGER = 0.022;
/** The pop starts a beat into the fade, so the rays arrive with the glyph. */
const POP_DELAY = 0.06;

/** Icon size, in px. */
const ICON = 20;

/** The night glyph's line trace — slower than the fade; it IS the entrance. */
const TRACE = 0.55;
const TRACE_EASE = "power1.inOut";

/** The sun's centre in the icons' 24×24 user space — the rays radiate from it. */
const RAY_ORIGIN = "12 12";

/** Every <path> directly inside the <svg>. For the sun that's its 8 rays and
 *  NOT the <circle> — the disc should hold still while they spring out. For the
 *  moon it's the single crescent, which is the line the trace draws. */
const PATH_SELECTOR = "svg > path";

/**
 * Sky-mode switcher — ONE glass disc, styled and sized exactly like the
 * back-to-top button (52px, same border/veil/blur recipe), sitting directly
 * above the navbar pill on the right edge.
 *
 * It replaces the old multi-icon rail: with only day and night offered, a
 * segmented control with a travelling highlight was more chrome than the choice
 * deserved. Clicking advances to the next offered mode; the shared store does
 * the rest, and ThemeDriver (sky) + ThemeRig (clouds) run the crossfade.
 *
 * ── The transition ──────────────────────────────────────────────────────────
 * Every offered mode's icon is rendered, stacked absolutely, and the OUTGOING
 * one always fades out (autoAlpha, so resting glyphs are `visibility: hidden`
 * and can't be tabbed to or hit-tested). How the INCOMING one arrives is per
 * glyph, flagged on its MODE_ITEMS entry:
 *
 *   • `rays` (the SUN) — fades in, and its ray paths POP: scaling from 0 out to
 *     1 with a `back.out` overshoot and a small stagger, so the lines spring
 *     outward rather than simply appearing. They scale about the glyph's centre
 *     (RAY_ORIGIN); each ray's own bbox centre would shrink it into its own
 *     middle instead of retracting it toward the disc.
 *   • `trace` (the MOON) — draws on as a line instead of fading. It does NOT
 *     fade: at time 0 no stroke is painted, so snapping it to full opacity is
 *     invisible and the draw stays crisp rather than surfacing through a fade.
 *   • neither — a plain cross-fade.
 *
 * ⚠️ `svgOrigin` is applied ONCE, in the mount pass, and deliberately never
 * re-sent in the pop tween. Re-declaring an svgOrigin on an element GSAP has
 * already transformed makes smoothOrigin fold a fresh compensating translate
 * into the matrix every time, which accumulates and walks the glyph off its
 * box — the exact bug that used to march the navbar's menu ✕ out of its pill
 * (menu-toggle-icon.tsx). Animate scale only.
 *
 * No `overflow-hidden` on the icon box, on purpose: `back.out` overshoots past
 * scale 1, and clipping would flatten the pop at its most visible moment.
 *
 * SSR: the icons are absolutely stacked, so before GSAP runs they would all
 * overlap. The resting ones therefore carry inline `opacity: 0; visibility:
 * hidden` as their pre-hydration state. Opacity rather than a transform is also
 * what keeps this honest: GSAP seeds its cache from the COMPUTED matrix, so a
 * pre-set inline `translate` would come back as a px `y` that `yPercent` can't
 * clear — that is what once left night mode with an empty button. Nothing here
 * pre-sets a transform, so there's nothing to inherit.
 *
 * PLACEMENT: shares the navbar's axis, so switcher, menu pill and back-to-top
 * read as one column. Derived from the navbar, and moves if it does:
 *   • The nav frame is `right-[33px] top-[62.4%]`, 365 tall, centred on its own
 *     height; the pill inside is `right-[22px]`, 52×149, centred. So the pill
 *     spans 62.4% ∓ 74.5px, its right edge 33+22 = 55px from the edge.
 *   • `right-[55px]` + `size-[52px]` puts this on the SAME centre-line as the
 *     pill and the back-to-top disc (52px at right-[55px] too).
 *   • `bottom: 37.6% + 87px` sits its bottom edge 12.5px above the pill's top —
 *     the mirror of back-to-top's 12.5px below its bottom.
 * Measured against the compiled CSS: all three 52px wide on a shared 55.2px
 * right inset and 81.2px centre-line, gaps 12.49 / 12.5.
 *
 * AN OPEN MENU SWALLOWS THIS. The nav glass expands to fill its whole 365×406
 * frame, which covers this disc completely (and the back-to-top one below the
 * pill). Rather than let it show through as a ghost puck, the glass ABSORBS it:
 * the chrome — border, fill, veil, blur — is a separate layer that dissolves as
 * the panel sweeps over it, leaving the icon sitting on the menu's own surface.
 * See menu-absorb.ts; the navbar publishes the geometry, this registers a
 * target. That's also why the disc sits ABOVE the panel (z-1000, not z-900):
 * dissolving underneath would drag the panel's edge across it as a visible seam,
 * while on top it stays whole and simply melts in.
 *
 * `data-menu-keep-open` exempts it from the navbar's click-outside close, so
 * picking a sky with the panel open previews it instead of dismissing the menu —
 * matching the in-panel theme column on mobile, which behaves the same way.
 *
 * It's a sibling of the fixed sky layers in layout.tsx (never an ancestor), so
 * it doesn't trip the no-filter-ancestor rule that governs those layers.
 *
 * Below md this is HIDDEN — on mobile the mode picker is folded INTO the one
 * bottom-centre menu pill (navbar.tsx), so only a single pill is ever on screen.
 * That column still renders MODE_ITEMS as separate buttons; this disc is the
 * desktop presentation of the same list, off the same source.
 */

type ModeItem = {
  mode: ThemeMode;
  label: string;
  Icon: typeof SunIcon;
  /** Pop this glyph's ray paths when it arrives. Day only: the sunrise/sunset
   *  glyphs draw their horizon as a <path> too, so popping "every path" there
   *  would spring the horizon line along with the rays. */
  rays?: boolean;
  /** Draw this glyph on as a line trace when it arrives, instead of fading it
   *  in. Night only — the moon is a single continuous stroke, which is what
   *  makes a trace read; a multi-path glyph would draw all its pieces at once. */
  trace?: boolean;
};

/** Every mode the palette supports, in time-of-day order. */
const ALL_MODE_ITEMS: ModeItem[] = [
  { mode: "sunrise", label: "Sunrise", Icon: SunriseIcon },
  { mode: "day", label: "Day", Icon: SunIcon, rays: true },
  { mode: "sunset", label: "Sunset", Icon: SunsetIcon },
  { mode: "night", label: "Night", Icon: MoonIcon, trace: true },
];

/** Modes NOT offered in the UI right now. Sunrise and sunset are built and fully
 *  working — palettes, cloud tints, the crossfade, the whole path — they're just
 *  not shown. Empty this set to put them back; the disc then CYCLES through
 *  however many are offered (the transition is written for any count). */
const HIDDEN_MODES: ReadonlySet<ThemeMode> = new Set<ThemeMode>(["sunrise", "sunset"]);

/**
 * The modes actually offered — by BOTH pickers (this disc and the navbar's
 * in-panel column), so the two can't drift into offering different sets.
 */
export const MODE_ITEMS: ModeItem[] = ALL_MODE_ITEMS.filter(
  ({ mode }) => !HIDDEN_MODES.has(mode),
);

// Keep the declared CATALOGUE exhaustive against the source-of-truth mode union.
// Deliberately checks ALL_MODE_ITEMS, not the offered subset: hiding a mode is a
// display decision and must not read as "a mode is missing from the list".
if (
  process.env.NODE_ENV !== "production" &&
  ALL_MODE_ITEMS.length !== THEME_MODES.length
) {
  console.warn("[mode-switcher] ALL_MODE_ITEMS is out of sync with THEME_MODES");
}

export default function ModeSwitcher() {
  const active = useMode();

  // Where the active mode sits in the offered list. A visitor whose stored mode
  // is one of the HIDDEN ones isn't in the list at all (found === -1): show the
  // first offered icon and let one click put them on it, rather than stranding
  // the disc on a glyph for a mode that can't be reached.
  const found = MODE_ITEMS.findIndex((item) => item.mode === active);
  const index = found === -1 ? 0 : found;
  const next = MODE_ITEMS[found === -1 ? 0 : (found + 1) % MODE_ITEMS.length];

  const iconRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const prevIndex = useRef(index);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const mounted = useRef(false);
  const rootRef = useRef<HTMLButtonElement>(null);
  const chromeRef = useRef<HTMLSpanElement>(null);
  const selectedRef = useRef<HTMLSpanElement>(null);

  // Offer this disc's glass to the navbar's expanding panel (see menu-absorb.ts).
  useEffect(() => {
    const root = rootRef.current;
    const chrome = chromeRef.current;
    if (!root || !chrome) return;
    return registerAbsorbable(root, chrome, selectedRef.current);
  }, []);

  useIsomorphicLayoutEffect(() => {
    const els = iconRefs.current;
    const from = prevIndex.current;
    const to = index;
    prevIndex.current = to;

    // First render: snap, and fix each glyph's ray pivot for good (see the
    // svgOrigin warning above — it is set here and nowhere else).
    //
    // It snaps to the STORE's mode, not to the rendered `index`. This is a
    // layout effect, so it runs after the hydration commit but before paint —
    // and at that moment getMode() already knows the persisted mode, while the
    // render that triggered it still carries useMode()'s server snapshot (day).
    // Snapping to the store and seeding prevIndex from it means the re-render
    // that follows the store sync arrives with from === to and animates nothing.
    // A night visitor therefore paints the moon outright instead of fading in
    // from the sun — the same flash-of-wrong-state the inline scripts in
    // layout.tsx exist to prevent.
    if (!mounted.current) {
      mounted.current = true;
      const stored = MODE_ITEMS.findIndex((item) => item.mode === getMode());
      const start = stored === -1 ? 0 : stored;
      prevIndex.current = start;
      els.forEach((el, i) => {
        if (!el) return;
        gsap.set(el, { autoAlpha: i === start ? 1 : 0 });
        const paths = el.querySelectorAll(PATH_SELECTOR);
        if (!paths.length) return;
        // Rest fully drawn and un-dashed, whichever entrance this glyph uses.
        gsap.set(paths, {
          svgOrigin: RAY_ORIGIN,
          scale: 1,
          strokeDasharray: "none",
          strokeDashoffset: 0,
        });
      });
      return;
    }
    if (from === to) return;

    const outgoing = els[from];
    const incoming = els[to];

    tlRef.current?.kill();
    const tl = gsap.timeline();
    if (outgoing) {
      tl.to(outgoing, { autoAlpha: 0, duration: FADE, ease: FADE_EASE }, 0);
    }
    if (incoming) {
      const item = MODE_ITEMS[to];
      const paths = incoming.querySelectorAll<SVGPathElement>(PATH_SELECTOR);

      if (item?.trace && paths.length) {
        // LINE TRACE (the moon). The stroke draws itself on, so this glyph does
        // NOT fade — at time 0 none of it is painted yet, which makes snapping
        // to full opacity invisible and keeps the draw crisp instead of
        // surfacing through a fade.
        //
        // Hand-rolled dash animation rather than GSAP's DrawSVGPlugin: that one
        // is Club-only and isn't a dependency here. Same technique it automates
        // — hide the stroke behind a dash as long as the path, then walk the
        // offset to 0. The moon's path starts at (12,3), the top of the box, so
        // the line grows from the top and sweeps round.
        tl.set(incoming, { autoAlpha: 1 }, 0);
        paths.forEach((path) => {
          const len = path.getTotalLength();
          tl.fromTo(
            path,
            { strokeDasharray: len, strokeDashoffset: len },
            { strokeDashoffset: 0, duration: TRACE, ease: TRACE_EASE },
            0,
          );
        });
        // Drop the dash once drawn, so the resting glyph is a plain stroke.
        tl.set(paths, { strokeDasharray: "none" });
      } else {
        tl.to(incoming, { autoAlpha: 1, duration: FADE, ease: FADE_EASE }, 0);
        // …and spring the rays out, for the glyphs that have them.
        if (item?.rays && paths.length) {
          tl.fromTo(
            paths,
            { scale: 0 },
            {
              scale: 1,
              duration: POP,
              ease: POP_EASE,
              stagger: POP_STAGGER,
            },
            POP_DELAY,
          );
        }
      }
    }

    tlRef.current = tl;
    return () => {
      tl.kill();
    };
  }, [index]);

  return (
    <button
      ref={rootRef}
      type="button"
      onClick={() => setMode(next.mode)}
      aria-label={`Switch to ${next.label.toLowerCase()} sky`}
      title={`Switch to ${next.label.toLowerCase()} sky`}
      // Clicking this with the menu open previews a sky instead of closing it.
      data-menu-keep-open
      className="group pointer-events-auto fixed right-[55px] bottom-[calc(37.6%_+_87px)] z-[1000] flex size-[52px] items-center justify-center rounded-full text-white max-md:hidden"
    >
      {/* The glass, as its own layer so the menu can dissolve it while the icon
          stays. Everything that makes this read as a puck lives here — the
          button itself is now just placement, hit area and focus ring. */}
      <span
        ref={chromeRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full border border-white/30 bg-white/10 shadow-[inset_0_0_28.3px_0_rgba(255,255,255,0.25)] backdrop-blur-[10px] transition-colors duration-200 group-hover:bg-white/20"
      />

      {/* …and what it becomes once the menu has it: the SELECTED chip from the
          panel's own theme column — the 36px bg-white/20 lit disc that marks the
          active mode on mobile (useSlidingHighlight's pill, same token, same
          size). Absorbed, this stops being a standalone puck and starts being a
          selected item in the menu, so it should look like one. Fades in on the
          coverage the chrome fades out on; `opacity-0` is its resting state, and
          the absorb module hands the property back to this class on close. */}
      <span
        ref={selectedRef}
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[36px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 opacity-0"
      />

      {/* Stacking box. No overflow clip — the ray pop overshoots past scale 1. */}
      <span
        className="relative block"
        style={{ width: ICON, height: ICON }}
      >
        {MODE_ITEMS.map((item, i) => (
          <span
            key={item.mode}
            ref={(el) => {
              iconRefs.current[i] = el;
            }}
            className="absolute inset-0 block"
            // Pre-hydration resting state (see the SSR note above). Opacity
            // only — never a transform, which GSAP would inherit as pixels.
            style={i === 0 ? undefined : { opacity: 0, visibility: "hidden" }}
          >
            <item.Icon style={{ width: ICON, height: ICON }} />
          </span>
        ))}
      </span>
    </button>
  );
}

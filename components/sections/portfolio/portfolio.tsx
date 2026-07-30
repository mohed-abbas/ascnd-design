"use client";

/**
 * Portfolio section — the cloud-canvas image globe.
 *
 * A 2D-canvas image globe (Fibonacci sphere, hand-rolled 3D projection, no
 * WebGL) of the project stills: it auto-spins, drags to rotate, and click-
 * focuses a tile. Unlike a scroll narrative it does NOT pin or scroll-scrub —
 * it's an explorable object that floats over the shared sky/cloud atmosphere.
 *
 * Ported standalone from the lab/portfolio-V2 variant selector (which also
 * carried the depth-gallery / carousel / cloudline designs); only the globe
 * came across. Tune presets live in the /lab/cloud-canvas sandbox (branch `dev`); the locked
 * portfolio preset (CLOUD_CANVAS_PORTFOLIO_CONFIG) is applied by CloudCanvasScene.
 *
 * Slots between Testimonials and Pricing. Stays TRANSPARENT with z-index at
 * `auto` (below the site's front cloud layer) ON PURPOSE, so the sky/cloud
 * atmosphere reads through the globe.
 *
 * LAYOUT — tabs at the top, heading at the globe's core:
 *
 *   • FILTER TABS sit alone in the top header row: one glass pill segmented
 *     control on the navbar's glass recipe (white/10 fill, white/30 hairline,
 *     inset sheen, backdrop-blur; blur is safe here — the tabs are a SIBLING of
 *     the fixed sky/cloud layers, never an ancestor). Selecting a type re-forms
 *     the globe to just that type's projects (cloud-canvas-engine.ts setFilter);
 *     "all" is the default. This is why the section is a client component: the
 *     tabs and the scene share the filter state.
 *
 *   • The HEADING (Figma 424:487 — the house 49px mixed-font display: "stuff
 *     we've " in Product Sans Light + "shipped" in Instrument Serif) is NOT a
 *     DOM element here. It's drawn by the engine at the globe's core, spliced
 *     into the painter's sort (config.coreLabel → cloud-canvas-engine.ts
 *     render()), so far tiles pass behind it and near tiles pass IN FRONT.
 *     A DOM heading can only sit above the whole canvas or below it — above
 *     made the type cover the portfolio, below let any faded far tile chop the
 *     words. Depth is what's being bought. The <h2> below is the accessible
 *     twin, visually hidden.
 *
 * The tab row is z-10 over the canvas and pointer-events-none, so nothing
 * blocks the globe's drag (only the tabs themselves re-enable hits).
 *
 * (No "see all work" button: the section is the whole body of work.)
 */
import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type SVGProps,
} from "react";
import { GlobeMode, GridMode } from "@/components/ui/icons";
import { useSlidingHighlight } from "@/components/ui/sliding-highlight";
import CloudCanvasScene from "./cloud-canvas-scene";
import {
  PROJECT_FILTERS,
  type CloudFilter,
} from "./cloud-canvas/cloud-canvas-data";
import PortfolioGrid from "./grid/portfolio-grid";
import {
  enterScene,
  exitMode,
  exitWall,
  restoreMode,
  restoreWall,
  useStagedSwap,
} from "./portfolio-swap";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** The two display modes. See docs/portfolio-grid-mode.md. */
type PortfolioMode = "globe" | "grid";

/**
 * The switcher's two options, as ICONS rather than the words "globe"/"grid"
 * (Figma "Startup" 862:850).
 *
 * `label` survives as the accessible name — it is no longer painted, so without
 * it each button would announce as "button" and the control would be unusable
 * by anyone not looking at it. It is the ONLY thing naming these now, which is
 * why it is required rather than optional here.
 *
 * The filter tabs beside them stay as words on purpose: "all / web designs /
 * brandings / misc" have no glyphs that would read faster than the words, and
 * two icon groups side by side would leave the row with nothing legible in it.
 */
const MODES: {
  value: PortfolioMode;
  label: string;
  Icon: (props: SVGProps<SVGSVGElement>) => ReactElement;
}[] = [
  { value: "globe", label: "globe", Icon: GlobeMode },
  { value: "grid", label: "grid", Icon: GridMode },
];

const SMALL_SCREEN = "(max-width: 768px)";

function subscribeSmallScreen(callback: () => void) {
  const mq = window.matchMedia(SMALL_SCREEN);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

/**
 * Is this a phone-width screen? Two consumers:
 *
 *  • the wall's COLUMN COUNT (D3, 4 vs 2)
 *  • the globe's AVAILABILITY — it is desktop-only, so below 768px `mode` is
 *    pinned to grid. Note the shape of that: it is a ceiling on what can be
 *    picked, not the default (grid has been the default on every device since
 *    2026-07-28). See the note at the `mode` line below.
 *
 * useSyncExternalStore with a `false` SERVER snapshot, the same idiom
 * cloud-layer.tsx uses for its device gate: SSR and the hydration render both
 * see "not mobile", then React re-renders with the real answer. Reading
 * matchMedia in the render path instead would be a hydration mismatch.
 *
 * What that costs is now bounded: a phone renders 4 columns on the server and
 * re-deals to 2 after hydration, which rebuilds the marquee once. It used to
 * additionally mount and tear down the globe canvas, which this no longer does.
 */
function useIsSmallScreen() {
  return useSyncExternalStore(
    subscribeSmallScreen,
    () => window.matchMedia(SMALL_SCREEN).matches,
    () => false,
  );
}

export default function Portfolio() {
  const [filter, setFilter] = useState<CloudFilter>("all");
  const { groupRef, pillRef } = useSlidingHighlight(filter);

  // MODE (D2, revised 2026-07-28). GRID IS THE DEFAULT EVERYWHERE. It used to
  // be per-device — globe on desktop, grid on a phone — and the switcher still
  // offers both; only which one you land on changed. A visitor who picks a mode
  // OWNS it: `chosen` wins from then on.
  //
  // Two things fall out of this that are worth not re-deriving:
  //
  //  • The default no longer reads the breakpoint, so a resize across it can no
  //    longer swap modes under someone who never touched the switcher. That
  //    used to happen — dragging a desktop window narrow flipped the globe to
  //    the wall mid-look.
  //  • SSR now renders the SAME mode as the client on every device. The old
  //    rule had a phone render the globe on the server (the server snapshot is
  //    `false`) and then swap to the wall on hydration, which mounted and tore
  //    down a canvas for nothing on exactly the devices least able to afford it.
  //
  // `isSmallScreen` is still needed below — it feeds the wall's column count —
  // it just no longer decides the mode.
  const isSmallScreen = useIsSmallScreen();
  const [chosen, setChosen] = useState<PortfolioMode | null>(null);
  // THE GLOBE IS DESKTOP-ONLY (2026-07-28). Below 768px the switcher is not
  // offered at all (see `max-md:hidden` on the mode group), so `grid` is not a
  // default there — it is the only mode.
  //
  // Yes, this puts the breakpoint back into `mode`, which §25.1 of the record
  // took out. The distinction is that it is now a CEILING rather than a default:
  // it can only ever move someone TO grid, never away from it, and only because
  // the globe is not on offer at that width. The bug §25.1 removed was a
  // visitor who had chosen NOTHING being flipped by a window drag; a visitor who
  // chose the globe on a desktop and then narrows past 768px is being moved off
  // a mode that no longer exists for them, and `chosen` is kept so widening
  // again gives it straight back.
  //
  // Server-side this changes nothing: the snapshot is `false`, and a non-mobile
  // render already resolved to `chosen ?? "grid"` = "grid" on first paint.
  const mode: PortfolioMode = isSmallScreen ? "grid" : (chosen ?? "grid");
  const { groupRef: modeGroupRef, pillRef: modePillRef } =
    useSlidingHighlight(mode);

  // ── THE STAGED HALF OF THE STATE (portfolio-swap.ts) ──
  //
  // `filter` and `mode` above are the CONTROLS: they commit the instant they
  // are clicked, which is what drives the pill, the highlight and aria-pressed.
  // `activeFilter` and `activeMode` are the CONTENT: they lag by exactly one
  // exit animation, so the outgoing wall (or canvas) gets to leave before the
  // incoming one arrives. Everything below the header renders the ACTIVE pair;
  // everything in the header renders the control pair. Mixing the two up is the
  // one way to break this — a control that waits reads as an unresponsive
  // button, and content that doesn't wait is the abrupt cut being fixed.
  //
  // A filter change only stages in GRID mode. The globe already animates its
  // own: setFilter re-forms the sphere toward new targets and evaporates the
  // tiles that dropped out (cloud-canvas-engine.ts), so fading the canvas out
  // first would hide the very transition it has.
  const activeMode = useStagedSwap(mode, exitMode, restoreMode);
  const activeFilter = useStagedSwap(
    filter,
    () => (activeMode === "grid" ? exitWall() : null),
    restoreWall,
  );

  // The globe's arrival. The wall brings its own (grid-reveal.tsx), so this is
  // deliberately one-sided rather than a symmetric container fade — see the
  // SCENE_ENTER note in portfolio-swap.ts.
  useIsomorphicLayoutEffect(() => {
    if (activeMode !== "globe") return;
    return enterScene();
  }, [activeMode]);

  return (
    // ASYMMETRIC padding, and the only section that can't just take `py-section`
    // on both sides — because its two edges present very differently:
    //   • BOTTOM: the sphere's lowest tiles run right to the canvas edge, so the
    //     boundary starts at hard imagery. It takes the full `pb-section`, and
    //     Comparison's own `pt-section` completes the house gap.
    //   • TOP: the band already opens with 10dvh of its own sky above the filter
    //     tabs (below), which is part of the same boundary. Only the remainder
    //     is padded here, or the gap coming out of working-with would run to
    //     ~1.5× the house value.
    // Both edges therefore land on the SAME boundary as every other section.
    <section
      id="work"
      data-portfolio
      className="relative w-full overflow-hidden pt-[8dvh] max-md:pt-[8svh] pb-section"
    >
      {/* The GLOBE BAND — an in-flow 100dvh block, and the containing block for
          the absolutely-positioned canvas.

          This exists so the section's bottom padding cannot reach the canvas.
          With `min-h-dvh` + padding on the section itself the padding lands
          INSIDE the 100dvh border box (border-box sizing), so the section never
          grows and the gap never changes; sizing the band explicitly and letting
          the section be content-driven puts the padding genuinely below it. It
          also pins the canvas to exactly 100dvh, which the tuned preset depends
          on — see cloud-canvas-scene.tsx for why a taller canvas would rescale
          the sphere instead of clearing it. */}
      {/* max-md:h-svh — the band must NOT be dynamically sized on a phone.
          `dvh` tracks the URL bar, so scrolling (especially UPWARD, which is
          what re-reveals the bar) changed this band's height mid-scroll, the
          ResizeObserver on the canvas fired, and engine.resize() reassigned
          canvas.width — which CLEARS the backing store. Every URL-bar movement
          therefore cost at least one blank frame, read as the tiles flashing
          and juddering the whole way up. `svh` is the SMALL viewport height:
          fixed, URL-bar-independent, so the band never resizes and the canvas
          is never reallocated during a scroll. Desktop keeps dvh (no URL bar,
          and dvh == svh there anyway). */}
      {/* flex-col so GRID mode can lay out as header-then-wall in normal flow:
          the heading and the controls sit ABOVE the grid, and the wall takes
          the remaining height (portfolio-grid.tsx is `flex-1 min-h-0`). The
          globe is unaffected — its canvas is `absolute inset-0`, out of flow,
          and keeps floating its controls over a full-bleed sphere. */}
      {/* ⚠️ THE HEIGHT IS MODE-DEPENDENT, and only the GRID side is free.
          The globe's band must stay exactly 100dvh (the note above) — its
          preset is tuned against that number, and a taller band rescales the
          sphere instead of clearing it. The wall has no such coupling: it is
          `flex-1` inside the band, so whatever the band gains, the wall gains.

          Grid runs taller because a masonry wall reads as a WALL only when it
          runs past the edges of what you can see. At 100dvh the wall was 745px
          of a 982px screen with the header above it — enough to show four
          columns, not enough to feel like a body of work you are looking
          THROUGH. The drift compounds this: a short wall loops visibly sooner,
          because a column's travel is its own height.

          GRID_BAND is the one number to turn. Everything downstream is
          derived — the wall takes the remainder, the mask's fades stay 12% of
          it, and grid-marquee.tsx re-measures its clone count on the resize. */}
      {/* activeMode, NOT mode: the band must not resize until the content it is
          sizing for is actually the content on screen. Reading the control here
          would snap the band from 100dvh to 130dvh under a globe that is still
          mid-fade, and the page below would jump before anything had changed. */}
      <div
        className={`relative flex w-full flex-col ${
          activeMode === "grid"
            ? // svh on mobile for the same URL-bar reason as the globe: a dvh
              // band would resize mid-scroll and rebuild the whole marquee.
              "h-[130dvh] max-md:h-[124svh]"
            : "h-dvh max-md:h-svh"
        }`}
      >
        {/* Top row — the controls. In GLOBE mode the heading lives at the
            sphere's core (painted by the engine), so this row carries the tabs
            alone, exactly as before. In GRID mode there is no canvas to paint
            into, so the heading has to be a real DOM element and it goes here
            (see the <h2> below). */}
        <div className="pointer-events-none relative z-10 flex w-full flex-col items-center gap-[26px] pt-[10dvh] max-md:pt-[10svh] max-md:px-6">
          {/* THE HEADING, in both modes — but only VISIBLE in grid mode.
              The globe paints these same words at the sphere's core
              (config.coreLabel) precisely so tiles can pass in front of them and
              behind them; a DOM heading can only sit wholly above the canvas or
              wholly below it, and depth is what that trick buys. Canvas text is
              invisible to screen readers and crawlers, so the real <h2> lives
              here either way and is merely hidden while the engine is the one
              drawing it. The grid has no canvas, so here it shows.
              Keep the words in sync with config.coreLabel. */}
          <h2
            // The handle the transitions use: grid-reveal.tsx fades it up with
            // the wall it belongs to, and portfolio-swap.ts fades it out with
            // the mode it is leaving. Always present, in both modes — while the
            // globe owns it the element is sr-only and any tween on it is
            // invisible, which is simpler than conditionally tagging it.
            data-portfolio-heading
            className={
              activeMode === "grid"
                ? // pointer-events-auto: the header row is none (so it can't
                  // block the globe's drag), which would also make this text
                  // unselectable. The heading is not interactive, but it should
                  // still be selectable like any other copy on the page.
                  "pointer-events-auto font-light text-[49px] leading-[1.1] tracking-[-0.03em] text-white max-md:text-[34px]"
                : "sr-only"
            }
          >
            stuff we&apos;ve <span className="font-instrument">shipped</span>
          </h2>

          {/* Controls row: the existing type filters + the mode switcher beside
              them (D6). They stack on a phone, where two pill groups side by
              side would overflow the gutters. */}
          <div className="flex items-center gap-[10px] max-md:flex-col max-md:gap-[12px]">
          <div
            ref={groupRef}
            role="group"
            aria-label="Filter projects by type"
            // The backdrop-blur runs on every input type, phones included. It
            // was briefly dropped on a coarse pointer: this pill sits z-10
            // DIRECTLY over the globe canvas, so the blur resamples its
            // backdrop on every canvas frame, and a backdrop-filter turns the
            // content behind it into a backdrop root, which can keep the canvas
            // off its own compositor layer. That was a *candidate* fix for the
            // tile flashing and was never confirmed to be the cause — and the
            // pill needs the glass. Restored: the cost is accepted knowingly.
            // `relative` so it's the pill's offsetParent (sliding-highlight.tsx).
            className="pointer-events-auto relative flex items-center gap-[2px] rounded-full border border-white/30 bg-white/10 p-[4px] shadow-[inset_0_0_18px_0_rgba(255,255,255,0.25)] backdrop-blur-[10px]"
          >
            {/* The travelling selection pill — ONE element that slides (and
                resizes, the labels differ in width) to the picked tab instead of
                the highlight blinking between slots. First in the DOM so the
                `relative` buttons paint over it. */}
            <span
              ref={pillRef}
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 rounded-full bg-white/25 opacity-0"
            />
            {PROJECT_FILTERS.map(({ value, label }) => {
              const isActive = value === filter;
              return (
                <button
                  key={value}
                  type="button"
                  data-highlight={value}
                  onClick={() => setFilter(value)}
                  aria-pressed={isActive}
                  className={`relative rounded-full px-5 py-[7px] text-[14px] lowercase leading-none transition-colors duration-300 max-md:px-3.5 max-md:text-[13px] ${
                    isActive ? "text-white" : "text-white/60 hover:text-white/90"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

            {/* MODE SWITCHER (D6) — the same glass pill as the filters, and its
                own sliding highlight. Deliberately a SEPARATE group rather than
                more segments in the filter pill: these are orthogonal axes (what
                you're looking at vs. how it's arranged), and merging them would
                imply picking "grid" deselects "brandings". The filter state is
                shared across both modes for exactly that reason.

                ⚠️ DESKTOP ONLY. `max-md:hidden` (display:none) takes the whole
                control out below 768px — out of the tab order and out of the
                accessibility tree, not merely invisible — because the globe is
                not offered on a phone. A one-option segmented control would be
                the alternative, and it is just noise.

                CSS rather than an unmount, for two reasons. It applies on the
                FIRST PAINT: `useIsSmallScreen`'s server snapshot is `false`, so
                a JS-gated unmount would render the switcher on the server and
                pull it back after hydration — a visible flash on exactly the
                device that is never allowed to use it. And keeping the group
                mounted keeps `useSlidingHighlight`'s geometry alive, so a
                desktop visitor who drags past the breakpoint and back doesn't
                get a pill sliding in from the corner on the way out. */}
            <div
              ref={modeGroupRef}
              role="group"
              aria-label="Choose how the work is displayed"
              className="pointer-events-auto relative flex items-center gap-[2px] rounded-full border border-white/30 bg-white/10 p-[4px] shadow-[inset_0_0_18px_0_rgba(255,255,255,0.25)] backdrop-blur-[10px] max-md:hidden"
            >
              <span
                ref={modePillRef}
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 rounded-full bg-white/25 opacity-0"
              />
              {MODES.map(({ value, label, Icon }) => {
                const isActive = value === mode;
                return (
                  <button
                    key={value}
                    type="button"
                    data-highlight={value}
                    onClick={() => setChosen(value)}
                    aria-pressed={isActive}
                    // The glyph is decorative; `aria-label` carries the name the
                    // words used to. Padding is symmetric (px == py) so the
                    // segments are square and the travelling pill stays round,
                    // rather than the lozenges the wider text labels produced.
                    //
                    // 5px is not a look, it's an ALIGNMENT: this pill sits
                    // directly beside the filter pill and the two must read as
                    // one control strip, so their outer heights have to match.
                    // Both wrappers add the same 1px border + 4px padding, which
                    // leaves the SEGMENTS to agree — and a filter segment is 28px
                    // (py-[7px] + 14px text at leading-none). So this one has to
                    // be 28px too: 5 + an 18px glyph + 5. At the 7px it used to
                    // carry it came out 32px and the mode pill stood 4px prouder
                    // than the filters. Change the glyph size or the filters'
                    // type scale and this number has to move with it.
                    aria-label={label}
                    title={label}
                    className={`relative flex items-center justify-center rounded-full p-[5px] transition-colors duration-300 ${
                      isActive ? "text-white" : "text-white/60 hover:text-white/90"
                    }`}
                  >
                    <Icon aria-hidden className="size-[18px] max-md:size-[17px]" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* THE TWO MODES ARE MUTUALLY EXCLUSIVE MOUNTS — never both rendered
            with one hidden by CSS (docs/portfolio-grid-mode.md §5). Each is a
            repaint source for the same visible section; keeping the loser
            mounted would pay for a canvas nobody can see. Unmounting is enough
            to stop it dead: CloudCanvasView's cleanup removes its ticker
            function, disposes the engine and disconnects every observer.
            Both read the SAME `filter` — switching modes never resets the tab. */}
        {/* activeMode / activeFilter — the STAGED pair (see the note where they
            are declared). The swap still happens in one frame, exactly as
            before; what changed is only WHEN that frame is, which is now after
            the outgoing side has animated away. */}
        {activeMode === "globe" ? (
          <CloudCanvasScene filter={activeFilter} />
        ) : (
          <PortfolioGrid filter={activeFilter} isMobile={isSmallScreen} />
        )}
      </div>
    </section>
  );
}

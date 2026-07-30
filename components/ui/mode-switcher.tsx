"use client";

import { setMode } from "@/lib/theme/mode-store";
import { useMode } from "@/lib/theme/use-mode";
import { THEME_MODES, type ThemeMode } from "@/lib/theme/palette";
import { MoonIcon, SunIcon, SunriseIcon, SunsetIcon } from "./icons";
import { useSlidingHighlight } from "./sliding-highlight";

/**
 * Sky-mode switcher — a vertical rail of time-of-day icons (air.inc-style), one
 * glass capsule in the house style (same recipe as the navbar surface). The
 * active mode's icon is lit; the rest sit dimmed. Clicking a mode calls the
 * shared store; ThemeDriver (sky) + ThemeRig (clouds) do the crossfade.
 *
 * The palette supports four modes but only DAY and NIGHT are offered — sunrise
 * and sunset are hidden (HIDDEN_MODES below). One consequence worth knowing: a
 * visitor whose stored mode is one of the hidden two still gets that sky, and
 * the rail simply lights nothing (useSlidingHighlight no-ops when it finds no
 * matching segment). Clicking day or night recovers. Nothing is stuck.
 *
 * The lit disc behind the active icon is ONE element that slides down/up the
 * rail to the picked mode (useSlidingHighlight) rather than a class that blinks
 * from slot to slot — so jumping sunrise → night visibly travels past day and
 * sunset. The navbar's mobile theme column runs the same mechanic.
 *
 * PLACEMENT: stacked directly ABOVE the navbar pill on the right edge, so the
 * three floating controls read as one column — rail, menu pill, back-to-top.
 * (It used to sit on the left edge, mirrored away from the navbar; it now shares
 * the navbar's axis instead.) The numbers are derived from the navbar, so they
 * move if it does:
 *   • The nav frame is `right-[33px] top-[62.4%]`, 365 tall, centred on its own
 *     height; the pill inside it is `right-[22px]`, 52×149, centred. So the pill
 *     spans 62.4% ∓ 74.5px and its right edge sits 33+22 = 55px from the edge.
 *   • `right-[55px]` + `w-[52px]` therefore puts this rail on the SAME
 *     centre-line as the pill and the back-to-top disc (which is 52px at
 *     right-[55px] too) — one vertical axis for all three.
 *   • `bottom: 37.6% + 87px` puts the rail's BOTTOM edge 12.5px above the pill's
 *     top edge — the exact mirror of back-to-top's 12.5px below its bottom
 *     (top-[calc(62.4%_+_87px)]). Anchoring by BOTTOM rather than top is what
 *     makes it grow UPWARD, so hiding or restoring a mode (HIDDEN_MODES above)
 *     re-flows the rail without disturbing that 12.5px gap.
 *
 * Like back-to-top, an OPEN menu covers this: the nav glass expands to fill its
 * whole 365×406 frame (navbar.tsx OPEN) at z-999, over this rail's z-900. That
 * is the existing behaviour of the back-to-top disc, not a new quirk.
 *
 * It's a sibling of the fixed sky layers in layout.tsx (never an ancestor), so
 * it doesn't trip the no-filter-ancestor rule that governs those layers.
 *
 * Below md this standalone rail is HIDDEN — on mobile the mode picker is folded
 * INTO the one bottom-centre menu pill (navbar.tsx), so only a single pill is
 * ever on screen (no two-pill confusion). The MODE_ITEMS list is exported so the
 * navbar's in-panel theme column renders the same modes off one source — which
 * is also what stops the two pickers offering different sets while some are
 * hidden. Desktop keeps the left vertical rail byte-for-byte (max-md: only).
 *
 * Ordered by time of day. Icons are decorative; each button carries an
 * aria-label + aria-pressed for the active state.
 */

type ModeItem = { mode: ThemeMode; label: string; Icon: typeof SunIcon };

/** Every mode the palette supports, in time-of-day order. */
const ALL_MODE_ITEMS: ModeItem[] = [
  { mode: "sunrise", label: "Sunrise", Icon: SunriseIcon },
  { mode: "day", label: "Day", Icon: SunIcon },
  { mode: "sunset", label: "Sunset", Icon: SunsetIcon },
  { mode: "night", label: "Night", Icon: MoonIcon },
];

/** Modes NOT offered in the UI right now. Sunrise and sunset are built and fully
 *  working — palettes, cloud tints, the crossfade, the whole path — they're just
 *  not shown. Empty this set to put them back; nothing else has to change. */
const HIDDEN_MODES: ReadonlySet<ThemeMode> = new Set<ThemeMode>(["sunrise", "sunset"]);

/**
 * The modes actually rendered — by BOTH pickers (this rail and the navbar's
 * in-panel column), so the two can't drift into offering different sets.
 */
export const MODE_ITEMS: ModeItem[] = ALL_MODE_ITEMS.filter(
  ({ mode }) => !HIDDEN_MODES.has(mode),
);

// Keep the declared CATALOGUE exhaustive against the source-of-truth mode union.
// Deliberately checks ALL_MODE_ITEMS, not the rendered subset: hiding a mode is
// a display decision and must not read as "a mode is missing from the list".
if (
  process.env.NODE_ENV !== "production" &&
  ALL_MODE_ITEMS.length !== THEME_MODES.length
) {
  console.warn("[mode-switcher] ALL_MODE_ITEMS is out of sync with THEME_MODES");
}

export default function ModeSwitcher() {
  const active = useMode();
  const { groupRef, pillRef } = useSlidingHighlight(active);

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label="Sky mode"
      // `relative` so it's the pill's offsetParent (see sliding-highlight.tsx).
      className="pointer-events-auto fixed right-[55px] bottom-[calc(37.6%_+_87px)] z-[900] flex w-[52px] flex-col items-center gap-[4px] rounded-full border border-white/30 bg-white/10 p-[6px] shadow-[inset_0_0_28.3px_0_rgba(255,255,255,0.25)] backdrop-blur-[10px] max-md:hidden"
    >
      {/* The travelling lit disc. First in the DOM so the `relative` buttons
          paint over it; GSAP owns its box, `opacity-0` is the pre-placement
          state so it never flashes at the rail's top-left. */}
      <span
        ref={pillRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 rounded-full bg-white/20 opacity-0"
      />
      {MODE_ITEMS.map(({ mode, label, Icon }) => {
        const isActive = mode === active;
        return (
          <button
            key={mode}
            type="button"
            data-highlight={mode}
            onClick={() => setMode(mode)}
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            className={`relative flex size-[36px] items-center justify-center rounded-full transition-colors duration-200 ${
              isActive ? "text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            <Icon className="size-[20px]" />
          </button>
        );
      })}
    </div>
  );
}

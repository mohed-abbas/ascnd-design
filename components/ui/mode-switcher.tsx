"use client";

import { setMode } from "@/lib/theme/mode-store";
import { useMode } from "@/lib/theme/use-mode";
import { THEME_MODES, type ThemeMode } from "@/lib/theme/palette";
import { MoonIcon, SunIcon, SunriseIcon, SunsetIcon } from "./icons";

/**
 * Sky-mode switcher — a vertical rail of four time-of-day icons (air.inc-style),
 * one glass capsule in the house style (same recipe as the navbar surface). The
 * active mode's icon is lit; the rest sit dimmed. Clicking a mode calls the
 * shared store; ThemeDriver (sky) + ThemeRig (clouds) do the crossfade.
 *
 * PLACEMENT: pinned to the LEFT edge, vertically centred. air.inc uses the right
 * edge, but our floating navbar already lives there (navbar.tsx, right-[33px],
 * vertically centred) — so the rail mirrors to the left to avoid colliding with
 * it. It's a sibling of the fixed sky layers in layout.tsx (never an ancestor),
 * so it doesn't trip the no-filter-ancestor rule that governs those layers.
 *
 * Below md the vertical side-rail would run straight down the hero headline (the
 * mobile content fills the full width — no side gutter for a rail to live in), so
 * it reflows to a HORIZONTAL capsule pinned bottom-centre, clear of the content
 * column. Desktop keeps the left vertical rail byte-for-byte (max-md: only).
 *
 * Ordered by time of day (sunrise → day → sunset → night). Icons are decorative;
 * each button carries an aria-label + aria-pressed for the active state.
 */

const MODES: { mode: ThemeMode; label: string; Icon: typeof SunIcon }[] = [
  { mode: "sunrise", label: "Sunrise", Icon: SunriseIcon },
  { mode: "day", label: "Day", Icon: SunIcon },
  { mode: "sunset", label: "Sunset", Icon: SunsetIcon },
  { mode: "night", label: "Night", Icon: MoonIcon },
];

// Keep the declared list exhaustive against the source-of-truth mode union.
if (process.env.NODE_ENV !== "production" && MODES.length !== THEME_MODES.length) {
  console.warn("[mode-switcher] MODES is out of sync with THEME_MODES");
}

export default function ModeSwitcher() {
  const active = useMode();

  return (
    <div
      role="group"
      aria-label="Sky mode"
      className="pointer-events-auto fixed left-[24px] top-1/2 z-[900] flex -translate-y-1/2 flex-col items-center gap-[4px] rounded-full border border-white/30 bg-white/10 p-[6px] shadow-[inset_0_0_28.3px_0_rgba(255,255,255,0.25)] backdrop-blur-[10px] max-md:left-1/2 max-md:top-auto max-md:bottom-[24px] max-md:-translate-x-1/2 max-md:translate-y-0 max-md:flex-row"
    >
      {MODES.map(({ mode, label, Icon }) => {
        const isActive = mode === active;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setMode(mode)}
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            className={`flex size-[36px] items-center justify-center rounded-full transition-colors duration-200 ${
              isActive
                ? "bg-white/20 text-white"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <Icon className="size-[20px]" />
          </button>
        );
      })}
    </div>
  );
}

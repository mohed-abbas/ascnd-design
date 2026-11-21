"use client";

import { setMode } from "@/lib/theme/mode-store";
import { THEME_MODES } from "@/lib/theme/palette";
import { useMode } from "@/lib/theme/use-mode";
import {
  ROCK_TREATMENTS,
  ROCK_TREATMENT_LABELS,
  setRockTreatment,
} from "@/lib/theme/rock-treatment";
import { useRockTreatment } from "@/lib/theme/use-rock-treatment";

/**
 * DEV-ONLY panel for comparing the rock mode-adaptation treatments
 * (lib/theme/rock-treatment.ts). Mounted through dev-tools.tsx, which drops it
 * from production bundles entirely.
 *
 * It also offers ALL four sky modes — the public switcher hides sunrise and
 * sunset (mode-switcher.tsx HIDDEN_MODES), but the treatments need checking in
 * every mode. A plain sibling of the fixed sky layers: no filter/backdrop-filter.
 */
export default function RockTreatmentSelector() {
  const treatment = useRockTreatment();
  const mode = useMode();

  const btn = (active: boolean) =>
    `rounded-full px-2.5 py-1 text-[12px] leading-none transition-colors ${
      active ? "bg-white text-[#0e2a52]" : "text-white/80 hover:bg-white/15"
    }`;

  return (
    <div
      data-menu-keep-open
      className="pointer-events-auto fixed bottom-4 left-4 z-[2000] flex flex-col gap-1.5 rounded-2xl bg-[#0b1f3d]/80 p-2 font-sans text-white shadow-lg max-md:hidden"
    >
      <div role="group" aria-label="Rock treatment" className="flex flex-wrap items-center gap-1">
        <span className="px-1.5 text-[11px] uppercase tracking-wide text-white/50">Rocks</span>
        {ROCK_TREATMENTS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={treatment === t}
            onClick={() => setRockTreatment(t)}
            className={btn(treatment === t)}
          >
            {ROCK_TREATMENT_LABELS[t]}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Sky mode" className="flex flex-wrap items-center gap-1">
        <span className="px-1.5 text-[11px] uppercase tracking-wide text-white/50">Sky</span>
        {THEME_MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`${btn(mode === m)} capitalize`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

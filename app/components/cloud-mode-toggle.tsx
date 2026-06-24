"use client";

import { setCloudMode, useCloudMode, type CloudMode } from "./cloud-mode";

/**
 * On-screen switch to flip the cloud rendering between the two looks for review
 * (see docs/cloud-color-and-lighting.md). Visualization aid for sharing both
 * options with the team — fixed, bottom-centre, above content. Remove or gate
 * behind an env flag once a direction is locked.
 */
const OPTIONS: { id: CloudMode; label: string; hint: string }[] = [
  { id: "lit", label: "Lit", hint: "Lambert + key light · dimensional" },
  { id: "flat", label: "Flat", hint: "Basic · unlit, flat white" },
];

export default function CloudModeToggle() {
  const mode = useCloudMode();

  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full border border-white/40 bg-white/15 p-1 shadow-lg backdrop-blur-md">
        <span className="px-2 text-[11px] font-medium uppercase tracking-wide text-white/80">
          Clouds
        </span>
        {OPTIONS.map((o) => {
          const active = mode === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setCloudMode(o.id)}
              aria-pressed={active}
              title={o.hint}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-white/80 hover:bg-white/15"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

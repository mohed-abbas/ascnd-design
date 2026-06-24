"use client";

import {
  setRockEntrance,
  useRockEntrance,
  type RockEntrance,
} from "./rock-entrance";

/**
 * On-screen switch to preview the rock entrance directions for review (see
 * docs/rock-entrance-animation.md) — the same review aid as the cloud Lit/Flat
 * toggle. Flipping replays the cliffs' entrance with the chosen option. Sits
 * just above the cloud toggle; remove or gate behind an env flag once a
 * direction is locked.
 */
const OPTIONS: { id: RockEntrance; label: string; hint: string }[] = [
  { id: "rise", label: "Rise", hint: "Option A · rise from the cloud sea" },
  { id: "slide", label: "Slide", hint: "Option B · slide in from the edges" },
  { id: "drift", label: "Drift", hint: "Option C · fade + soft settle" },
];

export default function RockEntranceToggle() {
  const mode = useRockEntrance();

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full border border-white/40 bg-white/15 p-1 shadow-lg backdrop-blur-md">
        <span className="px-2 text-[11px] font-medium uppercase tracking-wide text-white/80">
          Rocks
        </span>
        {OPTIONS.map((o) => {
          const active = mode === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setRockEntrance(o.id)}
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

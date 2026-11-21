"use client";

/**
 * Control panel for the /lab/cloud-canvas sandbox. Presentational: it renders the
 * knobs from CONFIG_RANGES and lifts every change up to the page, which owns the
 * live CloudCanvasConfig. "Copy config" serialises the current object so a tuned
 * look can be pasted back into cloud-canvas-config.ts as a named preset.
 *
 * Styled with house tokens (Product Sans, mono labels, glass) — deliberately NOT
 * the reference's brutalist CSS; only the wiring/semantics were ported.
 */
import { useState } from "react";
import {
  CONFIG_RANGES,
  CLOUD_PRESETS,
  type CloudCanvasConfig,
  type CloudCanvasMode,
  type CloudLayoutMode,
} from "@/components/sections/portfolio/cloud-canvas/cloud-canvas-config";
import {
  PROJECT_FILTERS,
  type CloudFilter,
} from "@/components/sections/portfolio/cloud-canvas/cloud-canvas-data";

interface ControlsProps {
  config: CloudCanvasConfig;
  onChange: (next: CloudCanvasConfig) => void;
  imageCount: number;
  /** Mirrors the portfolio section's type tabs — exercises the re-form here. */
  filter: CloudFilter;
  onFilterChange: (next: CloudFilter) => void;
}

const MODES: CloudCanvasMode[] = ["globe", "halo", "ascent", "cumulus"];
const LAYOUTS: CloudLayoutMode[] = ["manual", "auto", "balanced", "custom"];
const PRESET_NAMES = Object.keys(CLOUD_PRESETS);

export default function CloudCanvasControls({
  config,
  onChange,
  imageCount,
  filter,
  onFilterChange,
}: ControlsProps) {
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof CloudCanvasConfig>(key: K, value: CloudCanvasConfig[K]) =>
    onChange({ ...config, [key]: value });

  const setBalance = (key: keyof CloudCanvasConfig["balance"], value: number) =>
    onChange({ ...config, balance: { ...config.balance, [key]: value } });

  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const showAll = config.visibleCount === "all";

  return (
    <aside className="pointer-events-auto absolute left-4 top-4 z-10 flex max-h-[calc(100dvh-2rem)] w-[280px] flex-col gap-4 overflow-y-auto rounded-2xl border border-white/15 bg-black/35 p-5 text-white/90 backdrop-blur-md">
      <div>
        <h1 className="font-mono text-[13px] uppercase tracking-[0.1em] text-white">
          cloud canvas
        </h1>
        <p className="mt-1 text-[11px] text-white/50">tune · copy · paste as a preset</p>
      </div>

      {/* Formation — the same tiles in four arrangements (house segmented control). */}
      <div
        role="group"
        aria-label="Formation"
        className="flex items-center gap-[2px] rounded-full border border-white/20 bg-white/10 p-[3px]"
      >
        {MODES.map((m) => {
          const isActive = m === config.mode;
          return (
            <button
              key={m}
              type="button"
              onClick={() => set("mode", m)}
              aria-pressed={isActive}
              className={`flex-1 rounded-full px-2 py-[5px] font-mono text-[10px] lowercase tracking-[0.04em] transition-colors duration-200 ${
                isActive ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>

      {/* Type filter — the section tabs' behavior, for tuning the re-form. */}
      <div
        role="group"
        aria-label="Project type filter"
        className="flex items-center gap-[2px] rounded-full border border-white/20 bg-white/10 p-[3px]"
      >
        {PROJECT_FILTERS.map(({ value, label }) => {
          const isActive = value === filter;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onFilterChange(value)}
              aria-pressed={isActive}
              className={`flex-1 rounded-full px-1 py-[5px] font-mono text-[10px] lowercase tracking-[0.02em] transition-colors duration-200 ${
                isActive ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              {value === "all" ? label : value}
            </button>
          );
        })}
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onChange(CLOUD_PRESETS[name])}
            className="rounded-full border border-white/20 px-3 py-1 font-mono text-[11px] lowercase text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            {name}
          </button>
        ))}
      </div>

      {/* Numeric knobs */}
      <Range label="spread" value={config.spread} range={CONFIG_RANGES.spread} onChange={(v) => set("spread", v)} />
      <Range label="size" value={config.size} range={CONFIG_RANGES.size} onChange={(v) => set("size", v)} />
      <Range label="depth" value={config.depth} range={CONFIG_RANGES.depth} onChange={(v) => set("depth", v)} />
      <Range label="centre y" value={config.centerY} range={CONFIG_RANGES.centerY} onChange={(v) => set("centerY", v)} />
      <Range label="auto speed" value={config.autoSpeed} range={CONFIG_RANGES.autoSpeed} onChange={(v) => set("autoSpeed", v)} />

      {/* Visible count */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] lowercase text-white/60">count</span>
          <label className="flex items-center gap-1.5 font-mono text-[11px] text-white/60">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => set("visibleCount", e.target.checked ? "all" : imageCount)}
            />
            all
          </label>
        </div>
        <input
          type="range"
          min={1}
          max={imageCount}
          step={1}
          disabled={showAll}
          value={showAll ? imageCount : (config.visibleCount as number)}
          onChange={(e) => set("visibleCount", Number(e.target.value))}
          className="w-full accent-white disabled:opacity-40"
        />
      </div>

      {/* Layout */}
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] lowercase text-white/60">layout</span>
        <select
          value={config.layout}
          onChange={(e) => set("layout", e.target.value as CloudLayoutMode)}
          className="rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-[12px] text-white"
        >
          {LAYOUTS.map((l) => (
            <option key={l} value={l} className="text-black">
              {l}
            </option>
          ))}
        </select>
      </label>

      {config.layout === "custom" && (
        <div className="flex flex-col gap-2 rounded-lg border border-white/10 p-2">
          <Range label="portrait" value={config.balance.portrait} range={CONFIG_RANGES.balance} onChange={(v) => setBalance("portrait", v)} integer />
          <Range label="landscape" value={config.balance.landscape} range={CONFIG_RANGES.balance} onChange={(v) => setBalance("landscape", v)} integer />
          <Range label="square" value={config.balance.square} range={CONFIG_RANGES.balance} onChange={(v) => setBalance("square", v)} integer />
        </div>
      )}

      {/* Toggles */}
      <div className="flex flex-col gap-2">
        <Toggle label="tilt to centre" checked={config.tiltToCenter} onChange={(v) => set("tiltToCenter", v)} />
        <Toggle label="fade back" checked={config.fadeBack} onChange={(v) => set("fadeBack", v)} />
      </div>

      <button
        type="button"
        onClick={copyConfig}
        className="mt-1 rounded-lg border border-white/25 bg-white/10 px-3 py-2 font-mono text-[12px] lowercase text-white transition-colors hover:bg-white/20"
      >
        {copied ? "copied ✓" : "copy config"}
      </button>

      <p className="text-[10px] leading-relaxed text-white/40">
        drag to rotate · wheel to zoom · click a tile to focus
      </p>
    </aside>
  );
}

function Range({
  label,
  value,
  range,
  onChange,
  integer = false,
}: {
  label: string;
  value: number;
  range: { min: number; max: number; step?: number };
  onChange: (v: number) => void;
  integer?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between font-mono text-[11px] lowercase text-white/60">
        <span>{label}</span>
        <span className="tabular-nums text-white/80">{integer ? value : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step ?? 0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-white"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between font-mono text-[11px] lowercase text-white/70">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

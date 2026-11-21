"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { setMode, subscribeMode } from "@/lib/theme/mode-store";
import { useMode } from "@/lib/theme/use-mode";
import { CROSSFADE, THEME_MODES, type ThemeMode } from "@/lib/theme/palette";

/**
 * The rock grade playground's wrapper + control panel. See page.tsx for the
 * route and rocksplay.css for the three layers (filter · tint · rim) this
 * drives.
 *
 * One GRADE per theme mode, exactly the shape a production PALETTES[mode].rock
 * entry would take. The panel edits the ACTIVE mode's grade; switching mode (the
 * site rail or the buttons here) applies that mode's grade with the same 0.9s
 * crossfade the sky uses, so the switch itself can be judged too. The output
 * box holds all four grades as JSON, ready to paste back.
 *
 * Tuning is remembered per browser (localStorage) so a reload or a Fast Refresh
 * doesn't lose it. The panel mounts only after hydration, so reading storage in
 * its initial state can't cause a hydration mismatch.
 */

const BLENDS = [
  "multiply",
  "color",
  "soft-light",
  "overlay",
  "hue",
  "luminosity",
] as const;
type Blend = (typeof BLENDS)[number];

type Grade = {
  brightness: number;
  saturate: number;
  contrast: number;
  tint: string;
  tintBlend: Blend;
  tintStrength: number;
  rimColor: string;
  rimStrength: number;
  /** Where the light comes FROM, degrees: 0 top · 90 right · 180 bottom · 270 left. */
  rimFrom: number;
  /** How far the rim wash reaches across the rock, % of the box. */
  rimReach: number;
};

type Grades = Record<ThemeMode, Grade>;
type View = "graded" | "original" | "split";

// What the night rock is made of: the live CSS grade (the sliders), or one of
// the offline bakes (scratchpad bake-night-rock.mjs → public/lab/rocksplay/),
// which replace the night look entirely and crossfade in on the mode switch.
const SOURCES = [
  { id: "css", label: "css grade", src: null },
  {
    id: "baked-moonlit",
    label: "baked · moonlit",
    src: "/lab/rocksplay/footer-rock-night-moonlit.avif",
  },
  {
    id: "baked-silhouette",
    label: "baked · silhouette",
    src: "/lab/rocksplay/footer-rock-night-silhouette.avif",
  },
] as const;
type Source = (typeof SOURCES)[number]["id"];

const IDENTITY: Grade = {
  brightness: 1,
  saturate: 1,
  contrast: 1,
  tint: "#ffffff",
  tintBlend: "multiply",
  tintStrength: 0,
  rimColor: "#ffffff",
  rimStrength: 0,
  rimFrom: 45,
  rimReach: 55,
};

// Starting points. night = option B from the live A/B (filter + moonlight
// multiply) plus a faint moon rim from the upper right; the warm modes get a
// light warm multiply + a low sun rim from their side.
const DEFAULTS: Grades = {
  sunrise: {
    brightness: 1,
    saturate: 0.95,
    contrast: 1,
    tint: "#ffd2a8",
    tintBlend: "multiply",
    tintStrength: 0.35,
    rimColor: "#ffe2bf",
    rimStrength: 0.18,
    rimFrom: 300,
    rimReach: 60,
  },
  day: IDENTITY,
  sunset: {
    brightness: 0.92,
    saturate: 0.85,
    contrast: 1.03,
    tint: "#f4a58a",
    tintBlend: "multiply",
    tintStrength: 0.45,
    rimColor: "#ffc29a",
    rimStrength: 0.22,
    rimFrom: 60,
    rimReach: 60,
  },
  night: {
    brightness: 0.85,
    saturate: 0.6,
    contrast: 1,
    tint: "#5876a8",
    tintBlend: "multiply",
    tintStrength: 1,
    rimColor: "#a9c4ee",
    rimStrength: 0.25,
    rimFrom: 45,
    rimReach: 55,
  },
};

// Presets load into the ACTIVE mode. A and B are the two options compared live.
const PRESETS: { label: string; grade: (mode: ThemeMode) => Grade }[] = [
  { label: "mode default", grade: (m) => DEFAULTS[m] },
  { label: "original", grade: () => IDENTITY },
  {
    label: "A · filter only",
    grade: () => ({ ...IDENTITY, brightness: 0.5, saturate: 0.55, contrast: 1.08 }),
  },
  { label: "B · tint", grade: () => ({ ...DEFAULTS.night, rimStrength: 0 }) },
  { label: "B + moon rim", grade: () => DEFAULTS.night },
];

const STORAGE_KEY = "ascnd:lab:rocksplay";
const SOURCE_KEY = "ascnd:lab:rocksplay:source";

function loadSource(): Source {
  try {
    const raw = window.localStorage.getItem(SOURCE_KEY);
    const hit = SOURCES.find((s) => s.id === raw);
    if (hit) return hit.id;
  } catch {
    // Blocked storage — default below.
  }
  return "css";
}

function loadGrades(): Grades {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Grades>;
      return Object.fromEntries(
        THEME_MODES.map((m) => [m, { ...DEFAULTS[m], ...saved[m] }]),
      ) as Grades;
    }
  } catch {
    // Blocked / corrupt storage — start from the defaults.
  }
  return DEFAULTS;
}

const noopSubscribe = () => () => {};

export default function RocksPlayground({ children }: { children: ReactNode }) {
  const target = useRef<HTMLDivElement>(null);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Land on the footer: the page opens at the top (scrollRestoration is manual)
  // and the footer sits below a tall sky spacer (see page.tsx). One frame late so
  // the root LenisProvider has mounted; an idle Lenis adopts a native scroll.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div ref={target} className="rocksplay flex w-full flex-col">
      {children}
      {hydrated && <Panel target={target} />}
    </div>
  );
}

function Panel({ target }: { target: RefObject<HTMLDivElement | null> }) {
  const mode = useMode();
  const [grades, setGrades] = useState<Grades>(loadGrades);
  const [view, setView] = useState<View>("graded");
  const [source, setSource] = useState<Source>(loadSource);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const g = grades[mode];

  const set = (patch: Partial<Grade>) =>
    setGrades((all) => ({ ...all, [mode]: { ...all[mode], ...patch } }));

  // Tag the footer's two rock boxes (the <img>'s parent) so the sheet can reach
  // them without touching footer.tsx. DOM order: left rock first.
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const boxes = Array.from(
      el.querySelectorAll<HTMLImageElement>('[data-footer] img[src*="footer-rock"]'),
      (img) => img.parentElement,
    ).filter((b): b is HTMLElement => b !== null);
    boxes.forEach((b, i) => {
      b.dataset.rpRock = i === 0 ? "left" : "right";
    });
    return () => boxes.forEach((b) => delete b.dataset.rpRock);
  }, [target]);

  // The active mode's grade → the --rp-* vars the sheet reads.
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const vars: Record<string, string> = {
      "--rp-filter": `brightness(${g.brightness}) saturate(${g.saturate}) contrast(${g.contrast})`,
      "--rp-tint": g.tint,
      "--rp-tint-blend": g.tintBlend,
      "--rp-tint-strength": String(g.tintStrength),
      "--rp-rim": `linear-gradient(${g.rimFrom + 180}deg, ${g.rimColor} 0%, transparent ${g.rimReach}%)`,
      "--rp-rim-strength": String(g.rimStrength),
      "--rp-fade": `${CROSSFADE.duration}s`,
    };
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  }, [g, target]);

  useEffect(() => {
    const el = target.current;
    el?.setAttribute("data-view", view);
  }, [view, target]);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const src = SOURCES.find((s) => s.id === source)?.src;
    el.setAttribute("data-source", source);
    el.style.setProperty("--rp-baked", src ? `url(${src})` : "none");
    try {
      window.localStorage.setItem(SOURCE_KEY, source);
    } catch {
      // Best effort.
    }
  }, [source, target]);

  // Arm the crossfade for the length of a mode switch. Set synchronously from
  // the store emit, so it's on before React commits the new mode's vars.
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let tid: number | undefined;
    const unsubscribe = subscribeMode(() => {
      el.dataset.fading = "";
      window.clearTimeout(tid);
      tid = window.setTimeout(() => {
        delete el.dataset.fading;
      }, CROSSFADE.duration * 1000 + 50);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(tid);
      delete el.dataset.fading;
    };
  }, [target]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(grades));
    } catch {
      // Best effort — the session still keeps the tuning.
    }
  }, [grades]);

  const snippet = JSON.stringify(grades, null, 2);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard blocked — the text is still selectable in the box.
    }
  };

  return (
    <aside
      data-lenis-prevent
      // Top-centre, over the wordmark: both rocks hug the screen edges and the
      // site's mode rail sits on the right, so the middle is the one place the
      // panel hides nothing you're judging.
      className="fixed left-1/2 top-4 z-[1001] flex max-h-[calc(100dvh-32px)] w-[300px] -translate-x-1/2 flex-col gap-4 overflow-y-auto rounded-2xl bg-black/60 p-4 text-[12px] text-white backdrop-blur-md"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-[13px] font-medium">rock grade · {mode}</h1>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/20"
        >
          {open ? "hide" : "show"}
        </button>
      </div>

      {open && (
        <>
          <Row label="mode">
            {THEME_MODES.map((m) => (
              <Chip key={m} active={m === mode} onClick={() => setMode(m)}>
                {m}
              </Chip>
            ))}
          </Row>

          <Row label="night source">
            {SOURCES.map((s) => (
              <Chip key={s.id} active={s.id === source} onClick={() => setSource(s.id)}>
                {s.label}
              </Chip>
            ))}
          </Row>
          {source !== "css" && (
            <p className="-mt-2 text-white/60">
              baked sources replace the night look (switch to night to see them);
              the sliders below only drive the css grade and the other modes.
            </p>
          )}

          <Row label="view">
            {(["graded", "original", "split"] as const).map((v) => (
              <Chip key={v} active={v === view} onClick={() => setView(v)}>
                {v === "split" ? "split · L orig" : v}
              </Chip>
            ))}
          </Row>

          <Row label={`presets → ${mode}`}>
            {PRESETS.map((p) => (
              <Chip key={p.label} onClick={() => set(p.grade(mode))}>
                {p.label}
              </Chip>
            ))}
          </Row>

          <Group title="filter">
            <Slider label="brightness" value={g.brightness} min={0.2} max={1.4} step={0.01} onChange={(v) => set({ brightness: v })} />
            <Slider label="saturate" value={g.saturate} min={0} max={1.6} step={0.01} onChange={(v) => set({ saturate: v })} />
            <Slider label="contrast" value={g.contrast} min={0.6} max={1.5} step={0.01} onChange={(v) => set({ contrast: v })} />
          </Group>

          <Group title="tint (scene light)">
            <ColorField label="colour" value={g.tint} onChange={(v) => set({ tint: v })} />
            <label className="flex items-center justify-between gap-2">
              <span className="text-white/70">blend</span>
              <select
                value={g.tintBlend}
                onChange={(e) => set({ tintBlend: e.target.value as Blend })}
                className="rounded bg-white/10 px-1.5 py-0.5"
              >
                {BLENDS.map((b) => (
                  <option key={b} value={b} className="text-black">
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <Slider label="strength" value={g.tintStrength} min={0} max={1} step={0.01} onChange={(v) => set({ tintStrength: v })} />
          </Group>

          <Group title="rim (moon / sun key)">
            <ColorField label="colour" value={g.rimColor} onChange={(v) => set({ rimColor: v })} />
            <Slider label="strength" value={g.rimStrength} min={0} max={1} step={0.01} onChange={(v) => set({ rimStrength: v })} />
            <Slider label="light from (° · 0 top, 90 right)" value={g.rimFrom} min={0} max={359} step={1} onChange={(v) => set({ rimFrom: v })} />
            <Slider label="reach %" value={g.rimReach} min={10} max={100} step={1} onChange={(v) => set({ rimReach: v })} />
          </Group>

          <Group title="output (all modes)">
            <textarea
              readOnly
              value={snippet}
              rows={8}
              className="w-full resize-y rounded bg-black/40 p-2 font-mono text-[10px] leading-snug text-white/85"
            />
            <div className="flex gap-2">
              <Chip onClick={copy}>{copied ? "copied" : "copy json"}</Chip>
              <Chip onClick={() => set(DEFAULTS[mode])}>reset {mode}</Chip>
              <Chip onClick={() => setGrades(DEFAULTS)}>reset all</Chip>
            </div>
          </Group>
        </>
      )}
    </aside>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-white/60">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2.5 border-t border-white/15 pt-3">
      <legend className="pr-2 text-[11px] uppercase tracking-wider text-white/60">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Chip({
  active = false,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-1 transition-colors ${
        active ? "bg-white text-black" : "bg-white/10 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between gap-2 text-white/70">
        <span>{label}</span>
        <span className="font-mono text-white">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-white"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-white/70">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-white/85">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
        />
      </span>
    </label>
  );
}

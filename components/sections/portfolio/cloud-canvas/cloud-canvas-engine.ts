/**
 * CloudCanvasEngine — the image globe, drawn on a plain 2D canvas with hand-rolled
 * 3D (no WebGL). Ported from the reference `image-cloud-canvas.html` and adapted to
 * this codebase's contract:
 *
 *   • It owns NO scheduler — `tick(dtSeconds)` is called from the shared gsap.ticker
 *     by the React view (LenisProvider's "one loop, no competing schedulers").
 *   • It draws TRANSPARENT — clearRect only, never a background fill — so the globe
 *     floats over the site's global sky/cloud layers like every other section
 *     (the reference filled the canvas opaque white; that is removed here).
 *   • DPR is capped at 1.5 — the full site-wide cap, deliberately not lower
 *     (see DPR_CAP below: the design system values razor-sharp shots).
 *
 * Pipeline each frame: formation unit points (see below) → Euler rotate (yaw/pitch/
 * roll) → orthographic project (screen = centre + xy·radius) → painter's sort by
 * rotated z → draw each tile with depth-driven size + fade. Pointer drag rotates
 * with a fling/inertia model; wheel zooms; click focuses a tile (pulls it
 * forward/centre).
 *
 * FORMATIONS (config.mode) — one engine, one glass tile recipe, four arrangements
 * of the same matter (the site's air/altitude vocabulary):
 *   • "globe"   — Fibonacci sphere, slow spin (the shipped look).
 *   • "halo"    — braided two-radius orbital ring (the testimonial rocks' orbit
 *                 outlines); roll wobble off so the orbit reads stable.
 *   • "ascent"  — rising double-helix column; tiles climb and wrap, fading in at
 *                 the base and out at the top (cloud lifecycle, not a pop).
 *   • "cumulus" — flattened cloud-bank scatter (volume, not shell) with slow
 *                 collective drift + per-tile bob at offset phases — the same
 *                 motion grammar as the site's drei cloud layer.
 * Only the point set and its characteristic motion differ per mode; drag/fling,
 * hover, focus, zoom, and the glass-matted frame are identical across all four.
 *
 * FILTERING (setFilter) — the section's type tabs. The formation RE-FORMS rather
 * than leaving holes: the matching subset gets a fresh formation sized to its
 * count, surviving tiles glide from old to new positions (base → target lerp in
 * updateEasing), filtered-out tiles evaporate in place (visEase → 0: fade +
 * shrink), and returning tiles condense in AT their new spot (snapped while
 * invisible, so they never fly in from a stale position). One card exists per
 * project at all times; visibility is an eased per-card state, never a rebuild.
 *
 * LITE MODE (isLite) — a self-measured slow-canvas fallback, decided ONCE at
 * init (see benchmarkAtInit) and locked for the mount, never re-evaluated
 * mid-view. On CPU-rasterized canvas2d (Firefox/Linux, or Chromium with a
 * blocklisted GPU) the full recipe measured ~35ms/frame vs ~4.6ms accelerated —
 * enough to stall the shared gsap ticker and Lenis page-wide. Lite swaps in:
 *   • backing store at ratio 1.0 (CPU raster cost scales with pixels);
 *   • ONE pre-composited whole-tile sprite per card (see buildTileSprites) in
 *     place of drawCard's frame-blit + stroke + clip + cover-draw;
 *   • an alpha pull-down in place of the white haze overlay;
 *   • a per-tile edge-fade ramp (edgeFadeRamp) in place of the full-canvas
 *     destination-in composite (~8ms/frame on CPU raster on its own).
 * Full (non-lite) output is untouched — every lite branch is additive.
 *
 * Desktop scope. No flat board, no upload, no share-URL, no quality-tier gating
 * (feature-first, CLAUDE.md — degradation is a later pass).
 */
import type { CloudCanvasConfig } from "./cloud-canvas-config";
import type { CloudFilter, CloudProject } from "./cloud-canvas-data";

// ── Constants carried over from the reference ────────────────────────────────
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.399963 rad
const Y_SQUASH = 0.86; // flatten the sphere vertically, as the reference does
const DPR_CAP = 1.5; // the site-wide cap — the design system values razor-sharp
// shots (design-shots ships raw PNGs for the same reason), and ~28 rounded-rect
// draws leave 2D fill-rate headroom to spend on crispness.
const FAST_MAX_SIDE = 520; // downscale source images once for cheap per-frame draws
const FRAME_SPRITE_SCALE = 2.5; // frame sprites bake at 2.5× the authored slot px
// size, so the blit stays crisp through depth/zoom/DPR upscaling of near tiles
const TILE_SPRITE_SCALE = 1.5; // lite mode bakes each card's WHOLE visual at
// 1.5× the authored slot px — enough headroom over lite's 1.0 backing-store
// ratio that near tiles stay crisp, without paying 2.5× sprite memory per card
const LITE_RENDER_BUDGET_MS = 8; // init benchmark: avg full-recipe frame above
// this → CPU-rasterized canvas2d → lite mode (accelerated Chromium measures
// ~4.6ms, Firefox/Linux software raster ~35ms — the gap is unambiguous)
const DT_MAX = 0.034; // clamp step (~29fps floor) so a stall can't fling the globe

// ── Formation constants ──────────────────────────────────────────────────────
const HALO_OUTER = 1; // braided ring — alternating tiles sit on two radii so the
const HALO_INNER = 0.82; // orbit reads as a ring SYSTEM, not a queue
const HELIX_RADIUS = 0.62; // ascent column radius
const HELIX_TWIST = 3.0; // radians of twist per unit of height
const HELIX_WRAP = 1.15; // |y| where a climbing tile wraps base ↔ top
const HELIX_FADE_START = 0.88; // |y| where the pole fade begins (fade≈0 at wrap)
const CUMULUS_SCALE = { x: 1.32, y: 0.42, z: 0.78 }; // cloud-bank ellipsoid axes

type SlotType = "landscape" | "square" | "portrait";
const SLOT_SIZE: Record<SlotType, { w: number; h: number }> = {
  landscape: { w: 164, h: 104 },
  square: { w: 126, h: 126 },
  portrait: { w: 112, h: 146 },
};

interface LoadedImage {
  source: CanvasImageSource; // the downscaled fast copy
  aspect: number; // natural w/h, for "auto" slot classification
}

interface Card {
  index: number;
  image: CanvasImageSource;
  /** Slot shape — keys the pre-rendered glass-frame sprite (see frameSprite). */
  slot: SlotType;
  w: number;
  h: number;
  /** Current formation position — lerps toward target* (the re-form glide). */
  baseX: number;
  baseY: number;
  baseZ: number;
  /** Assigned formation position under the active filter. */
  targetX: number;
  targetY: number;
  targetZ: number;
  jitter: number;
  /** Per-mode phase: helix strand offset (ascent) / bob phase (cumulus). */
  phaseOffset: number;
  focusEase: number;
  hoverEase: number;
  dimEase: number;
  /** Filter visibility: 1 = in the active filter, 0 = filtered out. */
  visTarget: number;
  /** Eased visibility — drives the evaporate/condense fade + shrink. */
  visEase: number;
}

/** Lite-mode pre-composited tile (frame + hairline + shot) — see buildTileSprites. */
interface TileSprite {
  canvas: HTMLCanvasElement;
  /** Frame-box size in sprite px — the canvas adds `pad` of stroke bleed around it. */
  fw: number;
  fh: number;
  pad: number;
}

interface Projected {
  card: Card;
  screenX: number;
  screenY: number;
  x: number;
  z: number;
  /** Combined alpha: formation fade (ascent poles) × filter visEase. */
  fade: number;
}

// ── Pure geometry ────────────────────────────────────────────────────────────

/** i-th point of a Fibonacci lattice on the unit sphere (endpoint-inclusive). */
function fibonacciPoint(index: number, total: number) {
  const y = total <= 1 ? 0 : 1 - (index / (total - 1)) * 2; // [1, -1] top→bottom
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = index * GOLDEN_ANGLE;
  return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius };
}

/** Deterministic per-index 0..1 hash — stable layout across mounts, no RNG. */
function hash01(index: number): number {
  const s = Math.sin(index * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

/** Wrap v into [-limit, limit] (ascent's climb — top wraps back to the base). */
function wrapRange(v: number, limit: number): number {
  const span = limit * 2;
  return ((((v + limit) % span) + span) % span) - limit;
}

/**
 * Static base point + phase for card i in the given formation. "ascent" stores
 * only the climb coordinate (baseY) + strand phase — its x/z are a function of
 * the per-frame effective height, computed in render().
 */
function formationPoint(
  index: number,
  total: number,
  mode: CloudCanvasConfig["mode"],
): { x: number; y: number; z: number; phase: number } {
  if (mode === "halo") {
    // Braided orbit: sequential angle, alternating inner/outer radius, a whisper
    // of vertical jitter so the ring has body without losing its plane.
    const angle = (index / Math.max(1, total)) * Math.PI * 2;
    const radius = index % 2 === 0 ? HALO_OUTER : HALO_INNER;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(index * 13.7) * 0.055,
      z: Math.sin(angle) * radius,
      phase: 0,
    };
  }
  if (mode === "ascent") {
    // Even rungs up the column; two strands offset by π (a double helix), with a
    // touch of per-card angular jitter so the strands don't read machine-perfect.
    const y = total <= 1 ? 0 : (index / (total - 1)) * 2 - 1;
    const strand = (index % 2) * Math.PI;
    return { x: 0, y, z: 0, phase: strand + Math.sin(index * 7.3) * 0.18 };
  }
  if (mode === "cumulus") {
    // Volume, not shell: a Fibonacci direction pushed inward by a cube-root hash
    // radius (uniform in volume), then squashed to a cloud-bank ellipsoid.
    const p = fibonacciPoint(index, total);
    const r = Math.cbrt(0.16 + 0.84 * hash01(index)); // keep a hollow-free core
    return {
      x: p.x * r * CUMULUS_SCALE.x,
      y: p.y * r * CUMULUS_SCALE.y,
      z: p.z * r * CUMULUS_SCALE.z,
      phase: index * GOLDEN_ANGLE, // bob phase — every tile off-beat
    };
  }
  // "globe" — the original Fibonacci sphere.
  const p = fibonacciPoint(index, total);
  return { x: p.x, y: p.y * Y_SQUASH, z: p.z, phase: 0 };
}

/** Rotate a point by yaw (Y) → pitch (X) → roll (Z), in that order. */
function rotatePoint(
  px: number,
  py: number,
  pz: number,
  yaw: number,
  pitch: number,
  roll: number,
) {
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    cr = Math.cos(roll),
    sr = Math.sin(roll);
  // yaw about Y
  let x = px * cy - pz * sy;
  let z = px * sy + pz * cy;
  let y = py;
  // pitch about X
  const y2 = y * cp - z * sp;
  const z2 = y * sp + z * cp;
  y = y2;
  z = z2;
  // roll about Z
  const x3 = x * cr - y * sr;
  const y3 = x * sr + y * cr;
  x = x3;
  y = y3;
  return { x, y, z };
}

/**
 * Density auto-adjust, symmetric around the ~16–18 tile sweet spot:
 *   • CROWDING (>18): push tiles apart and shrink them so the formation
 *     doesn't clog (saturates at 52).
 *   • SPARSITY (<16): tighten the formation and grow the tiles so a small
 *     filter subset (8 brandings, 6 misc) condenses into a compact, full
 *     cloud instead of scattering over a 28-tile-sized sphere (saturates at
 *     6 — spread ×0.68, size ×1.18, ≈ the "all" tab's coverage per surface).
 */
function densityFactors(total: number) {
  if (total < 16) {
    const sparsity = Math.min(1, (16 - total) / 10);
    return { spread: 1 - sparsity * 0.32, size: 1 + sparsity * 0.18 };
  }
  if (total <= 18) return { spread: 1, size: 1 };
  const pressure = Math.min(1, (total - 18) / 34);
  return { spread: 1 + pressure * 0.18, size: 1 - pressure * 0.22 };
}

function classifyAspect(aspect: number): SlotType {
  if (aspect > 1.18) return "landscape";
  if (aspect < 0.88) return "portrait";
  return "square";
}

/** Choose a slot shape per tile according to the layout mode. */
function buildSlotTypes(
  total: number,
  config: CloudCanvasConfig,
  loaded: LoadedImage[],
  images: CloudProject[],
): SlotType[] {
  if (config.layout === "manual") {
    // The registry's authored form wins; natural aspect only backfills an
    // entry that somehow lacks one (type-safe callers never hit that).
    return Array.from(
      { length: total },
      (_, i) => images[i]?.form ?? classifyAspect(loaded[i]?.aspect ?? 1),
    );
  }
  if (config.layout === "auto") {
    return Array.from({ length: total }, (_, i) =>
      classifyAspect(loaded[i]?.aspect ?? 1),
    );
  }
  if (config.layout === "custom") {
    const { portrait, landscape, square } = config.balance;
    const sum = Math.max(1, portrait + landscape + square);
    const counts: Record<SlotType, number> = {
      portrait: Math.round((portrait / sum) * total),
      landscape: Math.round((landscape / sum) * total),
      square: Math.round((square / sum) * total),
    };
    // Fix rounding drift against `total`.
    let drift = total - (counts.portrait + counts.landscape + counts.square);
    const order: SlotType[] = ["portrait", "landscape", "square"];
    for (let k = 0; drift !== 0; k = (k + 1) % 3) {
      counts[order[k]] += drift > 0 ? 1 : -1;
      drift += drift > 0 ? -1 : 1;
    }
    // Round-robin interleave so equal shapes don't clump.
    const out: SlotType[] = [];
    const pools = { ...counts };
    while (out.length < total) {
      for (const t of order) {
        if (pools[t] > 0) {
          out.push(t);
          pools[t] -= 1;
          if (out.length >= total) break;
        }
      }
    }
    return out;
  }
  // "balanced" — a fixed cycle, independent of image content.
  const cycle: SlotType[] = ["portrait", "landscape", "square", "portrait", "landscape"];
  return Array.from({ length: total }, (_, i) => cycle[i % cycle.length]);
}

// ── Engine ───────────────────────────────────────────────────────────────────

export class CloudCanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: CloudCanvasConfig;
  private images: CloudProject[];

  private loaded: LoadedImage[] = [];
  private cards: Card[] = [];
  private projected: Projected[] = [];

  /** Active type filter (the section tabs). "all" shows every project. */
  private filter: CloudFilter = "all";
  /** How many cards the active filter keeps — sizes the formation + density. */
  private visibleTotal = 0;

  // Eased density factors. densityFactors() jumps the moment visibleTotal
  // changes on a tab click; easing these alongside the re-form lerp makes the
  // whole cloud contract/expand as one gesture instead of snapping radius.
  private denSpread = 1;
  private denSize = 1;
  private denSpreadTarget = 1;
  private denSizeTarget = 1;

  private cssW = 1;
  private cssH = 1;

  // Pre-rendered glass frames — drawCard steps 1–2 baked once per slot shape
  // (see frameSprite). Lazy: built on each shape's first draw.
  private frameSprites: Partial<Record<SlotType, HTMLCanvasElement>> = {};

  // LITE MODE — flipped once by benchmarkAtInit when the canvas measures as
  // CPU-rasterized, then locked for the mount (never re-evaluated mid-view).
  private lite = false;
  // Lite's per-card whole-tile sprites, indexed by card.index. Empty until the
  // benchmark flips lite; re-baked by rebuildCards when the card set changes.
  private tileSprites: (TileSprite | null)[] = [];

  // Edge-fade gradient cache (config.edgeFade). A CanvasGradient is cheap to
  // build, but there's no reason to rebuild one per frame — keyed on canvas
  // height + the fade stops, so it refreshes on resize or a stop change only.
  private fadeGradient: CanvasGradient | null = null;
  private fadeGradientKey = "";

  // Orientation / camera
  private yaw: number;
  private pitch: number;
  private roll = 0;
  private zoom: number;
  private velYaw = 0.002;
  private velPitch = 0;
  private releaseYaw = 0;
  private releasePitch = 0;

  // Formation motion — ascent's climb phase, cumulus' bob clock.
  private risePhase = 0;
  private modeTime = 0;

  // Pointer
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private pointerMoved = false;
  private hoveredIndex = -1;
  private focusedIndex = -1;

  private disposed = false;

  constructor(canvas: HTMLCanvasElement, config: CloudCanvasConfig, images: CloudProject[]) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("CloudCanvasEngine: 2D context unavailable");
    this.ctx = ctx;
    this.config = config;
    this.images = images;
    this.yaw = config.camera.yaw;
    this.pitch = config.camera.pitch;
    this.zoom = config.camera.zoom;
  }

  /** True when the init benchmark locked this engine into lite mode. */
  get isLite(): boolean {
    return this.lite;
  }

  /** Load + downscale every image, build the globe, then self-benchmark. */
  async init(): Promise<void> {
    this.loaded = await Promise.all(this.images.map((img) => loadFastImage(img.src)));
    if (this.disposed) return;
    this.rebuildCards();
    this.resize();
    this.benchmarkAtInit();
  }

  /**
   * Self-measured canvas speed probe — THE lite-mode decision. Renders two
   * representative full-recipe frames back-to-back through the real render()
   * with performance.now() timing (init is fired by the view's near-view
   * observer ~1000px before the section scrolls in, so nothing here is ever
   * user-visible) and takes the average. Above LITE_RENDER_BUDGET_MS we're on
   * a CPU-rasterized canvas2d — Firefox/Linux, or any Chromium whose GPU is
   * blocklisted into software raster — where this exact recipe measured
   * ~35ms/frame and stalled the shared gsap ticker (and Lenis) page-wide.
   * The decision is LOCKED here at init and never re-evaluated mid-view
   * (CLAUDE.md: tier decisions for mounted features are locked at mount — our
   * decision point is init, which completes before the globe can be seen).
   */
  private benchmarkAtInit(): void {
    const start = performance.now();
    this.render();
    this.render();
    const avg = (performance.now() - start) / 2;
    if (avg > LITE_RENDER_BUDGET_MS) {
      this.lite = true;
      this.buildTileSprites();
      // The initial resize() ran pre-benchmark at the full DPR cap; re-run it
      // now so the backing store shrinks to lite's 1.0 ratio (2.25× fewer
      // pixels at DPR≥1.5) before the first visible frame.
      this.resize();
    }
    this.ctx.clearRect(0, 0, this.cssW, this.cssH); // leave the canvas blank
  }

  setConfig(config: CloudCanvasConfig): void {
    const prev = this.config;
    this.config = config;
    // A mode/count/layout/balance change alters the card set; the rest are read live.
    const layoutChanged =
      prev.mode !== config.mode ||
      prev.visibleCount !== config.visibleCount ||
      prev.layout !== config.layout ||
      prev.balance.portrait !== config.balance.portrait ||
      prev.balance.landscape !== config.balance.landscape ||
      prev.balance.square !== config.balance.square;
    if (layoutChanged) this.rebuildCards();
    // An allMax change only re-shapes the current formation (glide, not rebuild).
    else if (prev.allMax !== config.allMax && this.cards.length) {
      this.assignFormation(false);
    }
    // A formation switch re-seats the camera on the new config's resting pose —
    // the geometry teleports anyway, and each formation needs its own vantage
    // (halo's high pitch, cumulus' wide zoom). Knob tweaks never touch the camera.
    if (prev.mode !== config.mode) {
      this.yaw = config.camera.yaw;
      this.pitch = config.camera.pitch;
      this.zoom = config.camera.zoom;
      this.velYaw = 0.002;
      this.velPitch = 0;
      this.releaseYaw = 0;
      this.releasePitch = 0;
    }
  }

  /**
   * Switch the active type filter. The matching subset gets a fresh formation
   * sized to its count (surviving tiles glide there); the rest evaporate.
   */
  setFilter(filter: CloudFilter): void {
    if (filter === this.filter) return;
    this.filter = filter;
    if (!this.cards.length) return; // pre-init: rebuildCards applies it later
    this.assignFormation(false);
    // A focused/hovered tile that just got filtered out releases its state —
    // otherwise the whole globe would stay dimmed around an invisible tile.
    if (this.focusedIndex >= 0 && !this.matchesFilter(this.focusedIndex)) {
      this.focusedIndex = -1;
    }
    if (this.hoveredIndex >= 0 && !this.matchesFilter(this.hoveredIndex)) {
      this.hoveredIndex = -1;
    }
  }

  private matchesFilter(index: number): boolean {
    return this.filter === "all" || this.images[index]?.type === this.filter;
  }

  private rebuildCards(): void {
    const total =
      this.config.visibleCount === "all"
        ? this.loaded.length
        : Math.min(this.loaded.length, Math.max(0, this.config.visibleCount));
    const slots = buildSlotTypes(total, this.config, this.loaded, this.images);
    this.cards = Array.from({ length: total }, (_, i) => {
      const slot = SLOT_SIZE[slots[i]];
      return {
        index: i,
        image: this.loaded[i].source,
        slot: slots[i],
        w: slot.w,
        h: slot.h,
        baseX: 0,
        baseY: 0,
        baseZ: 0,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        jitter: Math.sin(i * 19.19) * 0.13,
        phaseOffset: 0,
        focusEase: 0,
        hoverEase: 0,
        dimEase: 0,
        visTarget: 1,
        visEase: 1,
      };
    });
    this.assignFormation(true);
    // LITE: the card set (count/slots/images) just changed, so the per-card
    // sprites must follow. No-op pre-benchmark, while lite is still false.
    if (this.lite) this.buildTileSprites();
    if (this.focusedIndex >= total) this.focusedIndex = -1;
    if (this.hoveredIndex >= total) this.hoveredIndex = -1;
  }

  /**
   * Lay the filter's matching cards onto a formation sized to their count and
   * mark the rest for evaporation. `snap` (rebuild/mode switch — the geometry
   * teleports anyway) seats positions AND visibility instantly; a live filter
   * change instead leaves current state in place for updateEasing to glide.
   * Cards re-entering while invisible are snapped to their new spot in both
   * paths, so a returning tile condenses in place rather than flying across.
   */
  private assignFormation(snap: boolean): void {
    let visible = this.cards.filter((card) => this.matchesFilter(card.index));
    // The "all" tab is capped (config.allMax) so a growing registry can't
    // overcrowd the resting formation — first N in registry order win. Type
    // tabs always show every match.
    if (this.filter === "all" && this.config.allMax !== "none") {
      visible = visible.slice(0, Math.max(0, this.config.allMax));
    }
    this.visibleTotal = visible.length;
    const density = densityFactors(this.visibleTotal || this.cards.length);
    this.denSpreadTarget = density.spread;
    this.denSizeTarget = density.size;
    if (snap) {
      this.denSpread = density.spread;
      this.denSize = density.size;
    }
    const chosen = new Set(visible.map((card) => card.index));
    visible.forEach((card, j) => {
      const p = formationPoint(j, visible.length, this.config.mode);
      card.targetX = p.x;
      card.targetY = p.y;
      card.targetZ = p.z;
      card.phaseOffset = p.phase;
      card.visTarget = 1;
      if (snap || card.visEase <= 0.02) {
        card.baseX = p.x;
        card.baseY = p.y;
        card.baseZ = p.z;
      }
      if (snap) card.visEase = 1;
    });
    for (const card of this.cards) {
      if (!chosen.has(card.index)) {
        card.visTarget = 0;
        if (snap) card.visEase = 0;
      }
    }
  }

  /** Fit the backing store to the canvas's client box at capped DPR. */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    // LITE: CPU raster cost scales directly with backing-store pixels, so a
    // software canvas draws at 1.0 instead of the site-wide 1.5 cap — the soft
    // atmospheric look hides the resolution drop, the frame-time doesn't.
    const ratio = this.lite ? 1 : Math.min(window.devicePixelRatio || 1, DPR_CAP);
    this.canvas.width = Math.max(1, Math.floor(this.cssW * ratio));
    this.canvas.height = Math.max(1, Math.floor(this.cssH * ratio));
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0); // draw in CSS px
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "low";
  }

  // ── Frame ──────────────────────────────────────────────────────────────────

  tick(dtSeconds: number): void {
    if (this.disposed) return;
    const dt = Math.min(DT_MAX, Math.max(0, dtSeconds));
    const mode = this.config.mode;

    // Formation clocks. Ascent's PRIMARY motion is the climb, so its yaw autospin
    // is damped; cumulus drifts rather than spins. Clocks always advance (even
    // mid-drag) — the cloud keeps breathing and the thermal keeps rising.
    this.modeTime += dt;
    if (mode === "ascent") {
      this.risePhase += dt * (0.02 + this.config.autoSpeed * 0.14);
    }
    const autoFactor = mode === "ascent" ? 0.4 : mode === "cumulus" ? 0.55 : 1;

    if (!this.dragging) {
      this.velYaw += this.config.autoSpeed * 0.00022 * autoFactor;
      this.velYaw += this.releaseYaw;
      this.velPitch += this.releasePitch;
      this.releaseYaw *= 0.965;
      this.releasePitch *= 0.955;
      this.velYaw *= 0.972;
      this.velPitch *= 0.958;
      this.yaw += this.velYaw * dt * 60;
      this.pitch += this.velPitch * dt * 60;
    }
    // Per-mode pitch clamp: a ring shouldn't flip through its plane, a column
    // shouldn't lie down, a cloud bank stays near the horizon.
    const pitchLimit =
      mode === "halo" ? 0.65 : mode === "ascent" ? 0.4 : mode === "cumulus" ? 0.6 : 1.05;
    this.pitch = Math.max(-pitchLimit, Math.min(pitchLimit, this.pitch));
    // Roll wobble is the globe's gesture only — orbits/columns/banks read stable.
    this.roll = mode === "globe" ? Math.sin(this.yaw * 0.42) * 0.055 : 0;

    this.updateEasing(dt);
    this.render();
  }

  private updateEasing(dt: number): void {
    // Re-form glide (filter change): ~90% of the way in 0.5s, settled by ~1s.
    // Visibility fades a touch slower so departing tiles are still evaporating
    // while the survivors are already sliding into the tighter formation.
    const reform = 1 - Math.pow(0.01, dt);
    const vis = 1 - Math.pow(0.02, dt);
    this.denSpread += (this.denSpreadTarget - this.denSpread) * reform;
    this.denSize += (this.denSizeTarget - this.denSize) * reform;
    for (const card of this.cards) {
      const focusTarget = card.index === this.focusedIndex ? 1 : 0;
      const hoverTarget = card.index === this.hoveredIndex ? 1 : 0;
      const dimTarget = this.focusedIndex >= 0 && card.index !== this.focusedIndex ? 1 : 0;
      card.focusEase += (focusTarget - card.focusEase) * (1 - Math.pow(0.0024, dt));
      card.hoverEase += (hoverTarget - card.hoverEase) * (1 - Math.pow(0.0012, dt));
      card.dimEase += (dimTarget - card.dimEase) * (1 - Math.pow(0.0032, dt));
      card.baseX += (card.targetX - card.baseX) * reform;
      card.baseY += (card.targetY - card.baseY) * reform;
      card.baseZ += (card.targetZ - card.baseZ) * reform;
      card.visEase += (card.visTarget - card.visEase) * vis;
    }
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssW, this.cssH); // transparent over the sky

    const centerX = this.cssW * 0.5;
    const centerY = this.cssH * this.config.centerY;
    // Density follows the FILTERED count (eased — see denSpread/denSize): a
    // 6-project filter condenses into a small dense cloud, not a 28-slot
    // layout with holes.
    const radius =
      Math.min(this.cssW, this.cssH) * 0.45 * this.config.spread * this.denSpread * this.zoom;

    const mode = this.config.mode;
    this.projected = this.cards.map((card) => {
      // Effective (pre-rotation) position: static for globe/halo; ascent climbs
      // and wraps along its column; cumulus adds a per-tile bob.
      let bx = card.baseX;
      let by = card.baseY;
      let bz = card.baseZ;
      let fade = 1;
      if (mode === "ascent") {
        const effY = wrapRange(card.baseY + this.risePhase, HELIX_WRAP);
        const theta = effY * HELIX_TWIST + card.phaseOffset;
        bx = Math.cos(theta) * HELIX_RADIUS;
        by = effY;
        bz = Math.sin(theta) * HELIX_RADIUS;
        // Cloud lifecycle at the poles: condense in at the base, evaporate at
        // the top — never a pop at the wrap seam.
        fade = Math.max(
          0,
          Math.min(1, (HELIX_WRAP - Math.abs(effY)) / (HELIX_WRAP - HELIX_FADE_START)),
        );
      } else if (mode === "cumulus") {
        bx += Math.sin(this.modeTime * 0.42 + card.phaseOffset) * 0.028;
        by += Math.sin(this.modeTime * 0.58 + card.phaseOffset * 1.7) * 0.05;
      }
      fade *= card.visEase; // filter evaporation/condensation
      const r = rotatePoint(bx, by, bz, this.yaw, this.pitch, this.roll);
      let screenX = centerX + r.x * radius;
      let screenY = centerY + r.y * radius;
      let z = r.z;
      // Focus/hover warp — pull the focused tile toward centre + forward.
      screenX += (centerX - screenX) * 0.82 * card.focusEase;
      screenY += (centerY - screenY) * 0.82 * card.focusEase;
      z += (1.16 - z) * 0.58 * card.focusEase;
      z -= 0.28 * card.dimEase;
      z += 0.16 * card.hoverEase;
      // LITE edge fade: the full-canvas destination-in pass below costs ~8ms
      // per frame on CPU raster on its own, so lite folds the same stops into
      // a per-tile alpha ramp on the tile's screen centre instead — whole-tile
      // fade rather than a pixel gradient, visually close at these tile sizes.
      if (this.lite && this.config.edgeFade) {
        fade *= this.edgeFadeRamp(screenY);
      }
      return { card, screenX, screenY, x: r.x, z, fade };
    });
    this.projected.sort((a, b) => a.z - b.z); // painter's: far → near

    for (const p of this.projected) {
      if (p.fade <= 0.01) continue; // fully evaporated at the wrap seam
      this.drawCard(p, this.denSize);
    }

    // Edge fade (config.edgeFade) — the old .cloud-globe-mask CSS mask-image,
    // moved in-canvas. A CSS mask on a composited layer whose contents change
    // every frame forces an uncacheable full-screen render-surface + mask pass
    // per frame in the GPU process; here it's one destination-in gradient fill
    // over pixels we already own. Same stops, same dissolve. (Lite mode skips
    // this composite entirely — the same stops were applied per tile during
    // projection via edgeFadeRamp.)
    const edgeFade = this.config.edgeFade;
    if (edgeFade && !this.lite) {
      const key = `${this.cssH}|${edgeFade.top[0]},${edgeFade.top[1]},${edgeFade.bottom[0]},${edgeFade.bottom[1]}`;
      let grad = this.fadeGradient;
      if (!grad || this.fadeGradientKey !== key) {
        grad = ctx.createLinearGradient(0, 0, 0, this.cssH);
        // Transparent above top[0], opaque top[1]→bottom[0], transparent below
        // bottom[1] — destination-in keeps alpha only, the color is irrelevant.
        grad.addColorStop(edgeFade.top[0], "rgba(0,0,0,0)");
        grad.addColorStop(edgeFade.top[1], "rgba(0,0,0,1)");
        grad.addColorStop(edgeFade.bottom[0], "rgba(0,0,0,1)");
        grad.addColorStop(edgeFade.bottom[1], "rgba(0,0,0,0)");
        this.fadeGradient = grad;
        this.fadeGradientKey = key;
      }
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.cssW, this.cssH);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  /**
   * LITE stand-in for the destination-in edge fade: a clamped linear alpha
   * ramp over the tile's screen-space centre against the SAME config.edgeFade
   * stops — 0→1 across top[0]..top[1] of cssH, 1→0 across bottom[0]..bottom[1].
   */
  private edgeFadeRamp(screenY: number): number {
    const edgeFade = this.config.edgeFade;
    if (!edgeFade) return 1;
    const y = screenY / this.cssH;
    const [t0, t1] = edgeFade.top;
    const [b0, b1] = edgeFade.bottom;
    let ramp = 1;
    if (t1 > t0) ramp = Math.min(ramp, Math.max(0, Math.min(1, (y - t0) / (t1 - t0))));
    if (b1 > b0) ramp = Math.min(ramp, Math.max(0, Math.min(1, (b1 - y) / (b1 - b0))));
    return ramp;
  }

  private cardScale(p: Projected, densitySize: number): number {
    const depth = 2.05 - p.z * 0.78 * this.config.depth;
    const interaction =
      1 + p.card.focusEase * 0.28 + p.card.hoverEase * 0.08 - p.card.dimEase * 0.14;
    // Filtered-out tiles shrink as they fade — evaporation, not a dissolve.
    const vis = 0.6 + 0.4 * p.card.visEase;
    return (
      Math.max(0.2, 1 / Math.max(0.72, depth)) *
      1.42 *
      this.config.size *
      this.zoom *
      densitySize *
      interaction *
      vis
    );
  }

  private drawCard(p: Projected, densitySize: number): void {
    const ctx = this.ctx;
    const scale = this.cardScale(p, densitySize);
    const w = p.card.w * scale;
    const h = p.card.h * scale;

    let alpha = this.config.fadeBack
      ? Math.min(1, Math.max(0.24, 0.48 + p.z * 0.44))
      : 1;
    alpha *= p.fade; // formation fade (ascent's pole evaporation)
    alpha *= 1 - p.card.dimEase * 0.46;
    alpha = Math.min(1, alpha + p.card.hoverEase * 0.16);
    // Haze curve kept gentle (max ~0.34 at the far pole) — stronger and far
    // tiles read as blank white cards instead of photos in mist.
    const dim = this.config.fadeBack ? Math.max(0, 0.2 - p.z * 0.14) : 0;
    // LITE: the haze overlay would put a live fillRect-inside-a-clip back on
    // top of the one-blit sprite path, so approximate it by pulling alpha down
    // by the same amount instead. Visual tradeoff: far tiles fade slightly
    // into the sky rather than hazing white — acceptable in lite; the depth
    // cue (far = more atmospheric) survives.
    if (this.lite && dim > 0.01) alpha *= 1 - Math.min(0.44, dim);

    // Glass-matted frame — the exact design-shots / conveyor-arc recipe, as
    // constant fractions of the tile edge (authored at SHOT_BASE = 261px): corner
    // 14/261, mat ring 6.39/261, hairline border 1/261. The border therefore scales
    // WITH the tile (hair-thin) instead of being a fat fixed outline. Frame and shot
    // share ONE corner radius, and the frame sits BEHIND the shot — exactly like the
    // DOM tile (a frame div under the shot), so only the mat ring shows the glass.
    const base = Math.min(w, h);
    const r = base * (14 / 261);
    const mat = base * (6.39 / 261);
    const edge = Math.max(0.5, base / 261); // ≈ the design's 1px border, scaled down
    const fx = -w / 2 - mat;
    const fy = -h / 2 - mat;
    const fw = w + mat * 2;
    const fh = h + mat * 2;

    ctx.save();
    ctx.translate(p.screenX, p.screenY);
    const tilt = this.config.tiltToCenter ? Math.atan2(p.x, 1.4 + p.z) * 0.18 : 0;
    ctx.rotate(tilt + p.card.jitter * 0.08);
    ctx.globalAlpha = alpha;

    // LITE: the whole tile — frame + hairline + cover-cropped shot — was baked
    // once per card (buildTileSprites), so the per-frame cost collapses to a
    // single drawImage. Geometry is preserved exactly: every frame metric is a
    // fixed fraction of the tile edge, so the sprite's frame box downscales
    // uniformly onto the live (fx, fy, fw, fh); `pad` is the stroke's bleed
    // margin, scaled by the same factor. Hover/focus/dim still apply — they
    // are transforms + alpha, never sprite content.
    if (this.lite) {
      const sprite = this.tileSprites[p.card.index];
      if (sprite) {
        const k = fw / sprite.fw; // uniform scale sprite px → live px
        ctx.drawImage(
          sprite.canvas,
          fx - sprite.pad * k,
          fy - sprite.pad * k,
          fw + sprite.pad * 2 * k,
          fh + sprite.pad * 2 * k,
        );
        ctx.restore();
        return;
      }
    }

    // 1+2. Mat fill + inset sheen — blitted from the per-slot sprite (see
    // frameSprite below). Drawing the sheen live meant ctx.shadowBlur inside a
    // clip: Skia rasterizes that into a temp surface, Gaussian-blurs it, and
    // composites — per tile, per frame, and it was the dominant raster cost.
    // The sprite pays the blur ONCE per slot shape; this is one drawImage,
    // and because every frame metric (r, mat) is a fixed fraction of the tile
    // edge, the uniform downscale to (fw, fh) is visually identical.
    ctx.drawImage(this.frameSprite(p.card.slot), fx, fy, fw, fh);

    // 3. Hairline edge — white/40, one design-pixel thick (scaled with the tile).
    ctx.beginPath();
    ctx.roundRect(fx, fy, fw, fh, r);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = edge;
    ctx.stroke();

    // 4. The shot ON TOP — rounded (same radius), covering the frame centre so the
    // mat ring is what remains as the glass border.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, r);
    ctx.clip();
    ctx.globalAlpha = alpha;
    drawImageCover(ctx, p.card.image, -w / 2, -h / 2, w, h);
    if (dim > 0.01) {
      // Atmospheric haze, NOT black: this site's depth cue is receding INTO the
      // sky (white/alpha — the clouds, the rocks), never toward black, which
      // reads muddy over the bright atmosphere.
      ctx.globalAlpha = Math.min(0.44, dim);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();

    ctx.restore();
  }

  /**
   * Build (lazily, on first draw) the cached glass-frame sprite for a slot
   * shape: the mat fill + inset sheen at FRAME_SPRITE_SCALE× the slot's
   * authored px size, using the exact drawCard recipe — corner r = base·14/261,
   * mat = base·6.39/261, shadowBlur = mat, the same fill/stroke alphas. All of
   * those are fractions of the tile edge, so the sprite scales uniformly to any
   * live (fw, fh) without drifting from the hand-drawn look. Only the hairline
   * edge (step 3) stays live — its Math.max(0.5, …) floor must apply at final
   * scale, and a plain stroke is cheap.
   */
  private frameSprite(slot: SlotType): HTMLCanvasElement {
    const cached = this.frameSprites[slot];
    if (cached) return cached;
    const size = SLOT_SIZE[slot];
    const w = size.w * FRAME_SPRITE_SCALE;
    const h = size.h * FRAME_SPRITE_SCALE;
    const base = Math.min(w, h);
    const r = base * (14 / 261);
    const mat = base * (6.39 / 261);
    const fw = w + mat * 2;
    const fh = h + mat * 2;
    const off = document.createElement("canvas");
    off.width = Math.ceil(fw);
    off.height = Math.ceil(fh);
    const octx = off.getContext("2d");
    if (octx) {
      // 1. Mat fill — translucent white ring (bg-white/10).
      octx.beginPath();
      octx.roundRect(0, 0, fw, fh, r);
      octx.fillStyle = "rgba(255,255,255,0.1)";
      octx.fill();
      // 2. Inset white sheen — soft inner glow, clipped to the frame (glows
      // inward only) and BEHIND the shot, so only the mat ring lights up.
      // Matches the design's `inset 0 0 6.39px rgba(255,255,255,0.28)`.
      octx.save();
      octx.beginPath();
      octx.roundRect(0, 0, fw, fh, r);
      octx.clip();
      octx.beginPath();
      octx.roundRect(0, 0, fw, fh, r);
      octx.strokeStyle = "rgba(255,255,255,0.28)";
      octx.lineWidth = mat * 2;
      octx.shadowColor = "rgba(255,255,255,0.28)";
      octx.shadowBlur = mat;
      octx.stroke();
      octx.restore();
    }
    this.frameSprites[slot] = off;
    return off;
  }

  /**
   * LITE: pre-composite each card's WHOLE visual — frame sprite + hairline
   * edge + cover-cropped shot, i.e. drawCard steps 1–4 minus the per-frame
   * haze overlay (approximated by alpha in lite, see drawCard) — into one
   * offscreen canvas per card at TILE_SPRITE_SCALE× the authored slot px size.
   * Every frame metric (r, mat, edge) is a fixed fraction of the tile edge, so
   * the uniform downscale to the live frame box lands on the exact same
   * geometry; the only drift is that the hairline's Math.max(0.5, …) floor now
   * applies at bake scale rather than final scale (invisible at lite's 1.0
   * backing-store ratio). Re-baked whenever rebuildCards changes the card set;
   * cleared by dispose.
   */
  private buildTileSprites(): void {
    this.tileSprites = this.cards.map((card) => {
      const w = card.w * TILE_SPRITE_SCALE;
      const h = card.h * TILE_SPRITE_SCALE;
      const base = Math.min(w, h);
      const r = base * (14 / 261);
      const mat = base * (6.39 / 261);
      const edge = Math.max(0.5, base / 261);
      const fw = w + mat * 2;
      const fh = h + mat * 2;
      const pad = Math.ceil(edge); // bleed for the stroke's outer half
      const off = document.createElement("canvas");
      off.width = Math.ceil(fw + pad * 2);
      off.height = Math.ceil(fh + pad * 2);
      const octx = off.getContext("2d");
      if (!octx) return null;
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = "medium";
      octx.translate(pad, pad);
      // 1+2. Mat fill + inset sheen — the shared per-slot glass-frame sprite.
      octx.drawImage(this.frameSprite(card.slot), 0, 0, fw, fh);
      // 3. Hairline edge — white/40, same recipe as drawCard's live stroke.
      octx.beginPath();
      octx.roundRect(0, 0, fw, fh, r);
      octx.strokeStyle = "rgba(255,255,255,0.4)";
      octx.lineWidth = edge;
      octx.stroke();
      // 4. The shot ON TOP — rounded (same radius), centred in the mat ring so
      // only the ring shows the glass, exactly like the live path.
      octx.save();
      octx.beginPath();
      octx.roundRect(mat, mat, w, h, r);
      octx.clip();
      drawImageCover(octx, card.image, mat, mat, w, h);
      octx.restore();
      return { canvas: off, fw, fh, pad };
    });
  }

  // ── Pointer ──────────────────────────────────────────────────────────────────

  /**
   * True while the user is actively steering the globe — mid-drag, or while
   * the release fling still carries visible momentum. Pointer-linked motion
   * has the CURSOR as its on-screen reference frame, so a 60fps cap IS
   * perceptible there (unlike the ambient auto-drift, which has none). The
   * paint cap in cloud-canvas-view reads this to ride the display during
   * interaction and fall back to the 60 cap once the fling has decayed
   * (releaseYaw/Pitch shrink ~0.96×/frame, so the threshold releases the
   * uncap roughly a second after the fling visually settles).
   */
  get interacting(): boolean {
    return (
      this.dragging ||
      Math.abs(this.releaseYaw) > 0.001 ||
      Math.abs(this.releasePitch) > 0.001
    );
  }

  pointerDown(x: number, y: number): void {
    this.dragging = true;
    this.lastX = x;
    this.lastY = y;
    this.pointerMoved = false;
    this.velYaw = 0;
    this.velPitch = 0;
    this.releaseYaw = 0;
    this.releasePitch = 0;
    this.canvas.style.cursor = "grabbing";
  }

  pointerMove(x: number, y: number): void {
    if (!this.dragging) {
      this.updateHover(x, y);
      return;
    }
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    this.lastX = x;
    this.lastY = y;
    if (Math.abs(dx) + Math.abs(dy) > 3) this.pointerMoved = true;
    this.yaw += dx * 0.0038;
    this.pitch -= dy * 0.0032;
    const targetYaw = dx * 0.0009;
    const targetPitch = -dy * 0.00072;
    this.releaseYaw += (targetYaw - this.releaseYaw) * 0.36;
    this.releasePitch += (targetPitch - this.releasePitch) * 0.36;
  }

  pointerUp(x: number, y: number): void {
    if (!this.dragging) return;
    this.dragging = false;
    // Fling: boost + clamp the tracked release velocity.
    this.releaseYaw = Math.max(-0.016, Math.min(0.016, this.releaseYaw * 1.08));
    this.releasePitch = Math.max(-0.012, Math.min(0.012, this.releasePitch * 1.04));
    // A tap (not a drag) toggles focus on the tile under the pointer.
    if (!this.pointerMoved) {
      const hit = this.hitTest(x, y);
      this.focusedIndex = hit === this.focusedIndex ? -1 : hit;
    }
    this.updateHover(x, y);
  }

  pointerLeave(): void {
    this.dragging = false;
    this.hoveredIndex = -1;
    this.canvas.style.cursor = "grab";
  }

  wheel(deltaY: number): void {
    this.zoom = Math.max(0.55, Math.min(1.9, this.zoom - deltaY * 0.0007));
  }

  private updateHover(x: number, y: number): void {
    this.hoveredIndex = this.hitTest(x, y);
    this.canvas.style.cursor = this.hoveredIndex >= 0 ? "pointer" : "grab";
  }

  /** Front-most tile whose (unrotated) screen box contains (x,y); -1 if none. */
  private hitTest(x: number, y: number): number {
    for (let i = this.projected.length - 1; i >= 0; i -= 1) {
      const p = this.projected[i];
      if (p.fade <= 0.01) continue; // evaporated tiles aren't clickable
      if (p.card.visTarget === 0) continue; // mid-evaporation: already leaving
      const scale = this.cardScale(p, this.denSize);
      const halfW = (p.card.w * scale) / 2;
      const halfH = (p.card.h * scale) / 2;
      if (Math.abs(x - p.screenX) <= halfW && Math.abs(y - p.screenY) <= halfH) {
        return p.card.index;
      }
    }
    return -1;
  }

  dispose(): void {
    this.disposed = true;
    this.cards = [];
    this.projected = [];
    this.loaded = [];
    this.frameSprites = {};
    this.tileSprites = [];
    this.fadeGradient = null;
  }
}

// ── Image helpers ─────────────────────────────────────────────────────────────

/** Load an image and pre-downscale it once into an offscreen canvas. */
function loadFastImage(src: string): Promise<LoadedImage> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const w = img.naturalWidth || img.width || 1;
      const h = img.naturalHeight || img.height || 1;
      const ratio = Math.min(1, FAST_MAX_SIDE / Math.max(w, h));
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.round(w * ratio));
      off.height = Math.max(1, Math.round(h * ratio));
      const octx = off.getContext("2d");
      if (octx) {
        octx.imageSmoothingQuality = "medium";
        octx.drawImage(img, 0, 0, off.width, off.height);
      }
      resolve({ source: off, aspect: w / h });
    };
    img.onerror = () => {
      // A 1×1 transparent stand-in keeps indexing stable if a file is missing.
      const off = document.createElement("canvas");
      off.width = 1;
      off.height = 1;
      resolve({ source: off, aspect: 1 });
    };
    img.src = src;
  });
}

/** drawImage with object-fit: cover cropping into the target box. */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const iw = (image as HTMLCanvasElement).width || 1;
  const ih = (image as HTMLCanvasElement).height || 1;
  const sourceAspect = iw / ih;
  const targetAspect = width / height;
  let sx = 0,
    sy = 0,
    sw = iw,
    sh = ih;
  if (sourceAspect > targetAspect) {
    sw = ih * targetAspect;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / targetAspect;
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
}

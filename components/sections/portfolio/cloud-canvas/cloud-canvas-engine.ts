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
 *   • DPR is capped (≤1.5 site mandate; 1.25 here to bound 2D fill-rate).
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

  /** Load + downscale every image, then build the globe. */
  async init(): Promise<void> {
    this.loaded = await Promise.all(this.images.map((img) => loadFastImage(img.src)));
    if (this.disposed) return;
    this.rebuildCards();
    this.resize();
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
    const ratio = Math.min(window.devicePixelRatio || 1, DPR_CAP);
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
      return { card, screenX, screenY, x: r.x, z, fade };
    });
    this.projected.sort((a, b) => a.z - b.z); // painter's: far → near

    for (const p of this.projected) {
      if (p.fade <= 0.01) continue; // fully evaporated at the wrap seam
      this.drawCard(p, this.denSize);
    }
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

    // 1. Mat fill — translucent white ring (bg-white/10).
    ctx.beginPath();
    ctx.roundRect(fx, fy, fw, fh, r);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fill();

    // 2. Inset white sheen — soft inner glow, clipped to the frame (glows inward
    // only) and BEHIND the shot, so only the mat ring lights up. Matches the
    // design's `inset 0 0 6.39px rgba(255,255,255,0.28)`.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(fx, fy, fw, fh, r);
    ctx.clip();
    ctx.beginPath();
    ctx.roundRect(fx, fy, fw, fh, r);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = mat * 2;
    ctx.shadowColor = "rgba(255,255,255,0.28)";
    ctx.shadowBlur = mat;
    ctx.stroke();
    ctx.restore();

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

  // ── Pointer ──────────────────────────────────────────────────────────────────

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

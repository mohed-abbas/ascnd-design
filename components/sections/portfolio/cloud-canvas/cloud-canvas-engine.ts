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
 * Pipeline each frame: Fibonacci-sphere unit points → Euler rotate (yaw/pitch/roll)
 * → orthographic project (screen = centre + xy·radius) → painter's sort by rotated
 * z → draw each tile with depth-driven size + fade. Pointer drag rotates with a
 * fling/inertia model; wheel zooms; click focuses a tile (pulls it forward/centre).
 *
 * Pass 1 scope: globe view only, desktop. No flat board, no upload, no share-URL,
 * no quality-tier gating (feature-first, CLAUDE.md — degradation is a later pass).
 */
import type { CloudCanvasConfig } from "./cloud-canvas-config";
import type { CloudImage } from "./cloud-canvas-data";

// ── Constants carried over from the reference ────────────────────────────────
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.399963 rad
const Y_SQUASH = 0.86; // flatten the sphere vertically, as the reference does
const DPR_CAP = 1.25; // ≤ 1.5 site mandate; 1.25 keeps 2D fill-rate in check
const FAST_MAX_SIDE = 520; // downscale source images once for cheap per-frame draws
const DT_MAX = 0.034; // clamp step (~29fps floor) so a stall can't fling the globe

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
  baseX: number;
  baseY: number;
  baseZ: number;
  jitter: number;
  focusEase: number;
  hoverEase: number;
  dimEase: number;
}

interface Projected {
  card: Card;
  screenX: number;
  screenY: number;
  x: number;
  z: number;
}

// ── Pure geometry ────────────────────────────────────────────────────────────

/** i-th point of a Fibonacci lattice on the unit sphere (endpoint-inclusive). */
function fibonacciPoint(index: number, total: number) {
  const y = total <= 1 ? 0 : 1 - (index / (total - 1)) * 2; // [1, -1] top→bottom
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = index * GOLDEN_ANGLE;
  return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius };
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

/** Crowding auto-adjust: push tiles apart and shrink them past 18 images. */
function densityFactors(total: number) {
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
): SlotType[] {
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
  private images: CloudImage[];

  private loaded: LoadedImage[] = [];
  private cards: Card[] = [];
  private projected: Projected[] = [];

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

  // Pointer
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private pointerMoved = false;
  private hoveredIndex = -1;
  private focusedIndex = -1;

  private disposed = false;

  constructor(canvas: HTMLCanvasElement, config: CloudCanvasConfig, images: CloudImage[]) {
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
    // A count/layout/balance change alters the card set; the rest are read live.
    const layoutChanged =
      prev.visibleCount !== config.visibleCount ||
      prev.layout !== config.layout ||
      prev.balance.portrait !== config.balance.portrait ||
      prev.balance.landscape !== config.balance.landscape ||
      prev.balance.square !== config.balance.square;
    if (layoutChanged) this.rebuildCards();
  }

  private rebuildCards(): void {
    const total =
      this.config.visibleCount === "all"
        ? this.loaded.length
        : Math.min(this.loaded.length, Math.max(0, this.config.visibleCount));
    const slots = buildSlotTypes(total, this.config, this.loaded);
    this.cards = Array.from({ length: total }, (_, i) => {
      const p = fibonacciPoint(i, total);
      const slot = SLOT_SIZE[slots[i]];
      return {
        index: i,
        image: this.loaded[i].source,
        w: slot.w,
        h: slot.h,
        baseX: p.x,
        baseY: p.y * Y_SQUASH,
        baseZ: p.z,
        jitter: Math.sin(i * 19.19) * 0.13,
        focusEase: 0,
        hoverEase: 0,
        dimEase: 0,
      };
    });
    if (this.focusedIndex >= total) this.focusedIndex = -1;
    if (this.hoveredIndex >= total) this.hoveredIndex = -1;
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

    if (!this.dragging) {
      this.velYaw += this.config.autoSpeed * 0.00022;
      this.velYaw += this.releaseYaw;
      this.velPitch += this.releasePitch;
      this.releaseYaw *= 0.965;
      this.releasePitch *= 0.955;
      this.velYaw *= 0.972;
      this.velPitch *= 0.958;
      this.yaw += this.velYaw * dt * 60;
      this.pitch += this.velPitch * dt * 60;
    }
    this.pitch = Math.max(-1.05, Math.min(1.05, this.pitch));
    this.roll = Math.sin(this.yaw * 0.42) * 0.055;

    this.updateEasing(dt);
    this.render();
  }

  private updateEasing(dt: number): void {
    for (const card of this.cards) {
      const focusTarget = card.index === this.focusedIndex ? 1 : 0;
      const hoverTarget = card.index === this.hoveredIndex ? 1 : 0;
      const dimTarget = this.focusedIndex >= 0 && card.index !== this.focusedIndex ? 1 : 0;
      card.focusEase += (focusTarget - card.focusEase) * (1 - Math.pow(0.0024, dt));
      card.hoverEase += (hoverTarget - card.hoverEase) * (1 - Math.pow(0.0012, dt));
      card.dimEase += (dimTarget - card.dimEase) * (1 - Math.pow(0.0032, dt));
    }
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssW, this.cssH); // transparent over the sky

    const centerX = this.cssW * 0.5;
    const centerY = this.cssH * 0.47;
    const density = densityFactors(this.cards.length);
    const radius =
      Math.min(this.cssW, this.cssH) * 0.45 * this.config.spread * density.spread * this.zoom;

    this.projected = this.cards.map((card) => {
      const r = rotatePoint(card.baseX, card.baseY, card.baseZ, this.yaw, this.pitch, this.roll);
      let screenX = centerX + r.x * radius;
      let screenY = centerY + r.y * radius;
      let z = r.z;
      // Focus/hover warp — pull the focused tile toward centre + forward.
      screenX += (centerX - screenX) * 0.82 * card.focusEase;
      screenY += (centerY - screenY) * 0.82 * card.focusEase;
      z += (1.16 - z) * 0.58 * card.focusEase;
      z -= 0.28 * card.dimEase;
      z += 0.16 * card.hoverEase;
      return { card, screenX, screenY, x: r.x, z };
    });
    this.projected.sort((a, b) => a.z - b.z); // painter's: far → near

    for (const p of this.projected) this.drawCard(p, density.size);
  }

  private cardScale(p: Projected, densitySize: number): number {
    const depth = 2.05 - p.z * 0.78 * this.config.depth;
    const interaction =
      1 + p.card.focusEase * 0.28 + p.card.hoverEase * 0.08 - p.card.dimEase * 0.14;
    return (
      Math.max(0.2, 1 / Math.max(0.72, depth)) *
      1.42 *
      this.config.size *
      this.zoom *
      densitySize *
      interaction
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
    alpha *= 1 - p.card.dimEase * 0.46;
    alpha = Math.min(1, alpha + p.card.hoverEase * 0.16);
    const dim = this.config.fadeBack ? Math.max(0, 0.26 - p.z * 0.18) : 0;

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
      ctx.globalAlpha = Math.min(0.44, dim);
      ctx.fillStyle = "#000";
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
    const density = densityFactors(this.cards.length);
    for (let i = this.projected.length - 1; i >= 0; i -= 1) {
      const p = this.projected[i];
      const scale = this.cardScale(p, density.size);
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

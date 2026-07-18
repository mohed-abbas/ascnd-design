// Shared instrumentation for the Phase-0 canvas spike (docs/canvas-consolidation-
// plan.md). A plain module singleton is deliberate: the counters/flags are written
// from three unrelated places — the DOM-side IntersectionObserver, the in-canvas
// pump + tone-mapping useFrames, and read by the DOM HUD — and threading refs
// through the drei <View> portal boundary buys nothing here. This whole segment
// is dev-only (app/lab/layout.tsx 404s it in prod) and throwaway, so the singleton
// stays isolated to /lab/canvas-spike.

export type ViewName = "glass" | "clouds";

/** THREE tone-mapping enum → display name (node_modules/three/src/constants.js). */
export const TONE_NAMES: Record<number, string> = {
  0: "NoToneMapping",
  1: "LinearToneMapping",
  2: "ReinhardToneMapping",
  3: "CineonToneMapping",
  4: "ACESFilmicToneMapping",
  5: "CustomToneMapping",
  6: "AgXToneMapping",
  7: "NeutralToneMapping",
};

/** Monotonic raw counters + live state. The HUD samples deltas over its own
 *  window to derive per-second rates, so these only ever increment. */
export const spikeStats = {
  /** gsap.ticker callbacks fired (the pump increments this EVERY tick, even when
   *  gated off — so ticks/s stays visible while advance/s drops to 0 off-screen). */
  tickCount: 0,
  /** store.advance() calls (only when at least one view is on screen). */
  advanceCount: 0,
  /** patched GL draw calls (drawElements/Arrays[Instanced]). */
  drawCalls: 0,
  /** paint bursts — a new one starts after a >BURST_GAP_MS idle gap between draws
   *  (the same >4ms grouping the fps campaign used). One advance renders both
   *  views back-to-back (sub-ms apart) → one burst per tick. */
  paintBursts: 0,
  /** placeholder-rect visibility, written by the IntersectionObserver in spike.tsx. */
  visible: { glass: false, clouds: false } as Record<ViewName, boolean>,
  /** gl.toneMapping sampled INSIDE each view's render, written by <ToneMapping>.
   *  -1 = not yet rendered. Proves the two views render under different values. */
  toneMapping: { glass: -1, clouds: -1 } as Record<ViewName, number>,
};

export function anyVisible(): boolean {
  return spikeStats.visible.glass || spikeStats.visible.clouds;
}

// A new paint burst is counted when >4ms elapsed since the previous draw call.
const BURST_GAP_MS = 4;

const DRAW_METHODS = [
  "drawElements",
  "drawArrays",
  "drawElementsInstanced",
  "drawArraysInstanced",
] as const;

type GLCtx = WebGLRenderingContext | WebGL2RenderingContext;

/**
 * Monkeypatch THIS canvas's WebGL draw entrypoints to count draw calls and group
 * them into paint bursts. Returns an unpatch fn (restore the originals on unmount
 * so nothing leaks across Fast Refresh). WebGL1 lacks the *Instanced variants —
 * the typeof guard skips them.
 */
export function patchGL(ctx: GLCtx): () => void {
  let lastDraw = -Infinity;
  const target = ctx as unknown as Record<string, unknown>;
  const originals: Partial<Record<string, unknown>> = {};

  for (const name of DRAW_METHODS) {
    const orig = target[name];
    if (typeof orig !== "function") continue;
    originals[name] = orig;
    const fn = orig as (...args: unknown[]) => unknown;
    target[name] = function (this: unknown, ...args: unknown[]) {
      const now = performance.now();
      if (now - lastDraw > BURST_GAP_MS) spikeStats.paintBursts++;
      lastDraw = now;
      spikeStats.drawCalls++;
      return fn.apply(this, args);
    };
  }

  return () => {
    for (const name of DRAW_METHODS) {
      if (originals[name]) target[name] = originals[name];
    }
  };
}

/**
 * Per-plane view registry — the module store behind the shared canvas host
 * (Phase 1 of docs/canvas-consolidation-plan.md).
 *
 * This is the "tunnel" the useView contract rides on: a feature keeps its
 * placeholder <div> in its own DOM and registers a view here (id → descriptor +
 * r3f children); the plane's <Canvas> subscribes and renders each entry as a
 * drei <View>. Deliberately a plain module singleton (the same idiom
 * lib/perf/quality-store.ts and the spike's instrumentation use): the writers
 * (the registration hook, the host's IntersectionObserver, markDirty from
 * feature event handlers) and the reader (the ticker pump inside the Canvas)
 * live on opposite sides of the drei <View> portal boundary, and threading refs
 * through it buys nothing. Dependency-free (no tunnel-rat); no THREE at runtime
 * (toneMapping is stored as its numeric enum, imported as a type only) so a
 * plane with ZERO views never pulls three/drei into the bundle.
 *
 * TWO KINDS OF STATE per entry:
 *  - DESCRIPTOR (track/index/toneMapping/children/mode/fpsCap): React-visible.
 *    A structural change (register/update/unregister) rebuilds the plane's
 *    cached snapshot array and notifies, so the <Canvas> re-renders its Views.
 *  - RUNTIME (visible/dirty/burst): mutated in place by the IO, markDirty,
 *    requestBurst and the pump — NEVER emits (no React re-render); the pump reads
 *    the live entry objects each tick. This is what lets a repaint decision cost
 *    nothing but a field write.
 */

import type { ReactNode, RefObject } from "react";
// Type-only: keeps this module three-free at runtime. THREE.ToneMapping is a
// numeric enum, so a stored value is just a number.
import type * as THREE from "three";
import { PLANES, type PlaneName } from "./plane-config";

// Re-export so consumers can pull the plane type/list from the registry without
// reaching past it to the config.
export { PLANES, type PlaneName };

/** How a view decides it "wants paint" on a tick (see the pump). */
export type PaintMode = "continuous" | "demand";

/**
 * Per-view frame-rate cap, resolved against the quality store each tick:
 *  - "scroll" → scrollRepaintFpsCap() (uncapped on high, 60 on stepped-down)
 *  - "heavy"  → heavyEffectFpsCap()  (60 on fast panels / stepped-down, else 0)
 *  - number   → that fps. MUST be a POSITIVE number; use `null` for uncapped, not
 *               0. A 0/negative numeric cap is invalid (dev-warned at registration)
 *               — the "uncapped" sentinel is `null`, and the store cap fns' own 0
 *               return is normalized to Infinity by the pump.
 *  - null     → uncapped (ride the display refresh)
 */
export type FpsCap = "scroll" | "heavy" | number | null;

export interface ViewDescriptor {
  track: RefObject<HTMLElement | null>;
  index: number;
  toneMapping: THREE.ToneMapping;
  /**
   * Optional per-view exposure, set alongside toneMapping at priority index-1.
   * Renderer-level like toneMapping, but a UNIFORM (not a program-cache key), so
   * it's even safer to switch per view. Phase 3's testimonial rocks want
   * AgXToneMapping + exposure 1.15; defaults to 1 when omitted.
   */
  toneMappingExposure?: number;
  children: ReactNode;
  mode: PaintMode;
  fpsCap: FpsCap;
}

export interface ViewEntry extends ViewDescriptor {
  id: string;
  // ── runtime (imperative; not part of snapshot identity) ──
  /** placeholder rect intersects the viewport (host IntersectionObserver). */
  visible: boolean;
  /** demand view has changed since its last paint (markDirty sets it). */
  dirty: boolean;
  /** remaining forced-paint frames (requestBurst / restore / tab re-show). */
  burst: number;
}

interface PlaneState {
  entries: Map<string, ViewEntry>;
  /** Cached snapshot for useSyncExternalStore — new ref only on structural change. */
  snapshot: ViewEntry[];
  listeners: Set<() => void>;
  /** Optional dpr ceiling override (Phase 2's intro dpr-1 welcome window). */
  dprOverride: number | null;
  dprListeners: Set<() => void>;
  /** Remount key — bumped by the ContextWatchdog on an unrecoverable loss. */
  remountKey: number;
  /** Live pump counters (used by the lab HUD + future phase verification). */
  debug: { ticks: number; advances: number };
}

const EMPTY_SNAPSHOT: ViewEntry[] = [];

function newPlane(): PlaneState {
  return {
    entries: new Map(),
    snapshot: EMPTY_SNAPSHOT,
    listeners: new Set(),
    dprOverride: null,
    dprListeners: new Set(),
    remountKey: 0,
    debug: { ticks: 0, advances: 0 },
  };
}

// Built from the config table (data-driven) so a new plane is a single additive
// entry in plane-config.ts — nothing here enumerates plane names.
const planes = Object.fromEntries(
  PLANES.map((p) => [p, newPlane()]),
) as Record<PlaneName, PlaneState>;

function emit(p: PlaneState) {
  // Rebuild the cached array so useSyncExternalStore sees a new reference.
  p.snapshot = p.entries.size === 0 ? EMPTY_SNAPSHOT : Array.from(p.entries.values());
  for (const l of p.listeners) l();
}

// ── Registration (called by useSharedView) ──────────────────────────────────

/** Register a view (mount) or overwrite an existing id's descriptor. Runtime
 *  state (visible/dirty/burst) is PRESERVED across a re-register/update so a
 *  children change doesn't reset an in-flight burst. */
export function upsertView(plane: PlaneName, id: string, d: ViewDescriptor) {
  const p = planes[plane];
  const existing = p.entries.get(id);
  if (existing) {
    existing.track = d.track;
    existing.index = d.index;
    existing.toneMapping = d.toneMapping;
    existing.toneMappingExposure = d.toneMappingExposure;
    existing.children = d.children;
    existing.mode = d.mode;
    existing.fpsCap = d.fpsCap;
  } else {
    // Dev-only sanity checks — run once, on first registration (not on every
    // descriptor update), so they never spam.
    if (process.env.NODE_ENV !== "production") {
      // MINOR: a 0/negative numeric cap is invalid (the uncapped sentinel is
      // `null`). Warn rather than silently mis-pace.
      if (typeof d.fpsCap === "number" && d.fpsCap <= 0) {
        console.warn(
          `[canvas] view "${id}" on plane "${plane}" has fpsCap ${d.fpsCap}; a numeric cap must be > 0 (use null for uncapped).`,
        );
      }
      // MINOR: each view occupies index slots {index-1 (tone setter), index
      // (render)}. Two views collide unless their indices differ by ≥2. Warn on a
      // collision so tone setters can't silently clobber a neighbour's render.
      for (const other of p.entries.values()) {
        if (Math.abs(other.index - d.index) <= 1) {
          console.warn(
            `[canvas] index collision on plane "${plane}": view "${id}" index ${d.index} is within 1 of view "${other.id}" index ${other.index}. Space indices ≥2 apart (see indices.ts) — the tone setter at index-1 will collide.`,
          );
        }
      }
    }
    p.entries.set(id, {
      id,
      ...d,
      visible: false,
      dirty: false,
      burst: 0,
    });
  }
  emit(p);
}

export function unregisterView(plane: PlaneName, id: string) {
  const p = planes[plane];
  if (p.entries.delete(id)) emit(p);
}

// ── Runtime mutations (no emit — pump reads live entries) ────────────────────

export function markDirty(plane: PlaneName, id: string) {
  const e = planes[plane].entries.get(id);
  if (e) e.dirty = true;
}

/** Force the view to paint for the next `n` ticks (drei geometry that builds
 *  over frames, context-restore, tab re-show). */
export function requestBurst(plane: PlaneName, id: string, n: number) {
  const e = planes[plane].entries.get(id);
  if (e) e.burst = Math.max(e.burst, n);
}

export function setVisible(plane: PlaneName, id: string, visible: boolean) {
  const e = planes[plane].entries.get(id);
  if (e) e.visible = visible;
}

/** Update a view's paint policy IN PLACE — no emit, no snapshot rebuild, no
 *  React re-render. mode/fpsCap are read live by the pump each tick, so they
 *  never needed to be React-visible; routing them through upsertView made every
 *  scroll start/stop tear down the plane's IntersectionObserver and reconcile
 *  the <View> list (the exact scroll-path churn this architecture removes).
 *  useSharedView calls this from its policy effect; features just flip their
 *  descriptor as before. */
export function setPaintPolicy(
  plane: PlaneName,
  id: string,
  mode: PaintMode,
  fpsCap: FpsCap,
) {
  const e = planes[plane].entries.get(id);
  if (e) {
    e.mode = mode;
    e.fpsCap = fpsCap;
  }
}

/** Burst every view on a plane (context restore / tab re-show). */
export function burstAll(plane: PlaneName, n: number) {
  for (const e of planes[plane].entries.values()) e.burst = Math.max(e.burst, n);
}

// ── Pump-side reads (imperative, per tick) ───────────────────────────────────

export function forEachEntry(plane: PlaneName, cb: (e: ViewEntry) => void) {
  for (const e of planes[plane].entries.values()) cb(e);
}

export function getDebug(plane: PlaneName) {
  return planes[plane].debug;
}

// ── React store bindings (useSyncExternalStore) ──────────────────────────────

export function subscribePlane(plane: PlaneName, cb: () => void): () => void {
  const p = planes[plane];
  p.listeners.add(cb);
  return () => p.listeners.delete(cb);
}

export function getPlaneSnapshot(plane: PlaneName): ViewEntry[] {
  return planes[plane].snapshot;
}

/** Server + first-client snapshot: always empty, so SSR renders no canvas. */
export function getPlaneServerSnapshot(): ViewEntry[] {
  return EMPTY_SNAPSHOT;
}

export function getPlaneCount(plane: PlaneName): number {
  return planes[plane].entries.size;
}

export function getRemountKey(plane: PlaneName): number {
  return planes[plane].remountKey;
}

export function bumpRemountKey(plane: PlaneName) {
  const p = planes[plane];
  p.remountKey += 1;
  emit(p);
}

// ── dpr override (Phase-2 hook point — intro welcome dpr 1) ───────────────────

export function subscribeDpr(plane: PlaneName, cb: () => void): () => void {
  const p = planes[plane];
  p.dprListeners.add(cb);
  return () => p.dprListeners.delete(cb);
}

export function getDprOverride(plane: PlaneName): number | null {
  return planes[plane].dprOverride;
}

/** Clamp the plane's dpr ceiling below the site cap (or null to release).
 *  Wired by Phase 2 for the welcome window; unused in Phase 1. */
export function setPlaneDprOverride(plane: PlaneName, dpr: number | null) {
  const p = planes[plane];
  if (p.dprOverride === dpr) return;
  p.dprOverride = dpr;
  for (const l of p.dprListeners) l();
}

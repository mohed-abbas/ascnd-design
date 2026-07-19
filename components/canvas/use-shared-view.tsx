"use client";

import { useCallback, useEffect, useId, useMemo, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import type * as THREE from "three";
import {
  markDirty as registryMarkDirty,
  requestBurst as registryRequestBurst,
  setPaintPolicy,
  unregisterView,
  upsertView,
  type FpsCap,
  type PaintMode,
  type PlaneName,
} from "./view-registry";

/**
 * useSharedView — the registration contract Phases 2–5 code against
 * (docs/canvas-consolidation-plan.md, Phase 1).
 *
 * A feature keeps its placeholder <div> in its OWN DOM (it owns layout/styling)
 * and renders its 3D content through this hook. The r3f `children` are passed as
 * config here (React elements — just descriptors, safe to render elsewhere); the
 * host's plane <Canvas> renders them inside a drei <View track index> with the
 * per-view tone-mapping setter at priority index-1. The div stays where the
 * feature puts it; the <Canvas> is a fixed sibling that scissors each view to its
 * track's rect. When NO feature calls this hook on a plane, that plane's <Canvas>
 * never mounts (zero GL cost) — which is what keeps Phase 1 invisible in prod.
 *
 * RETURNS the two paint controls (stable identities):
 *  - markDirty()      — replaces every old invalidate() call. Flags the view to
 *                       paint on the next tick (demand mode). No-op-cheap; the
 *                       ticker pump does the actual advance().
 *  - requestBurst(n)  — force-paint for the next n ticks (the InvalidateOnReady
 *                       replacement: drei geometry that builds over frames, a
 *                       just-revealed view). Continuous views don't need it.
 *
 * INDEX: pass an explicit index from indices.ts (FRONT_INDEX.* / REAR_INDEX.* /
 * TESTIMONIAL_ROCKS_INDEX) — unique per plane, spaced ≥2 so the index-1 tone
 * setter never collides.
 */
export interface SharedViewOptions {
  plane: PlaneName;
  index: number;
  track: RefObject<HTMLElement | null>;
  toneMapping: THREE.ToneMapping;
  toneMappingExposure?: number;
  /** "continuous" = paint every visible tick; "demand" = only when dirty/bursting. */
  mode: PaintMode;
  /** Per-view rate cap resolved against the quality store each tick. */
  fpsCap: FpsCap;
  /** The r3f scene for this view (NO <View>/tone setter — the host adds those). */
  children: ReactNode;
}

export interface SharedViewControls {
  markDirty: () => void;
  requestBurst: (n: number) => void;
}

export function useSharedView(opts: SharedViewOptions): SharedViewControls {
  const {
    plane,
    index,
    track,
    toneMapping,
    toneMappingExposure,
    mode,
    fpsCap,
    children,
  } = opts;

  // Stable per-instance id (survives re-renders; unique across instances).
  const id = useId();

  // Paint policy is a RUNTIME field, not a structural one: the pump reads
  // mode/fpsCap live each tick, so flipping them must not re-register the view
  // (an upsert emit rebuilds the plane snapshot → PlaneCanvas re-render → IO
  // teardown — per-scroll-gesture churn, caught in the Phase-4 review). This
  // effect is declared FIRST so on mount the ref is seeded before the
  // structural effect below creates the entry; on later flips setPaintPolicy
  // mutates the live entry with zero React involvement.
  const policyRef = useRef({ mode, fpsCap });
  useEffect(() => {
    policyRef.current = { mode, fpsCap };
    setPaintPolicy(plane, id, mode, fpsCap);
  }, [plane, id, mode, fpsCap]);

  // Register on mount / update the descriptor on STRUCTURAL change / unregister
  // on unmount. upsertView preserves runtime state (visible/dirty/burst) across
  // an update, so a children change never resets an in-flight burst. Note the
  // cleanup ordering: a structural dep change unregisters then re-creates the
  // entry — features keep `children` memoized so this is mount/unmount-rare.
  useEffect(() => {
    upsertView(plane, id, {
      track,
      index,
      toneMapping,
      toneMappingExposure,
      children,
      ...policyRef.current,
    });
    return () => unregisterView(plane, id);
  }, [plane, id, track, index, toneMapping, toneMappingExposure, children]);

  const markDirty = useCallback(() => registryMarkDirty(plane, id), [plane, id]);
  const requestBurst = useCallback(
    (n: number) => registryRequestBurst(plane, id, n),
    [plane, id],
  );

  return useMemo(
    () => ({ markDirty, requestBurst }),
    [markDirty, requestBurst],
  );
}

/**
 * Declarative wrapper around useSharedView for callers that don't need the
 * controls inline. Renders nothing in the DOM (the placeholder div is the
 * caller's own). For markDirty/requestBurst access, receive them via `onReady`
 * (called once with the stable controls) or use the hook directly.
 */
export function SharedView(
  props: SharedViewOptions & { onReady?: (controls: SharedViewControls) => void },
) {
  const { onReady, ...opts } = props;
  const controls = useSharedView(opts);
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onReady?.(controls);
  }, [controls, onReady]);
  return null;
}

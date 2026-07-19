"use client";

import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";

/**
 * Per-view tone-mapping switch — the mechanism proven in the Phase-0 spike
 * (app/lab/canvas-spike/tone-mapping.tsx), generalized for the production host.
 *
 * Tone mapping is a RENDERER-level flag, but different views need different
 * values on ONE shared renderer (intro glass → NoToneMapping; clouds → ACES).
 * drei's <View> renders each scissored viewport in a useFrame at priority =
 * the View's `index`, and all portals share the root's ONE priority-sorted
 * subscriber list. A setter at priority `index - 1` therefore runs immediately
 * BEFORE that view's render and sets gl.toneMapping for exactly that view.
 *
 * SAFE on three r183: toneMapping is part of the program cache key, and a
 * material is only ever rendered under ONE tone mapping here, so it compiles
 * once and never recompiles. LOAD-BEARING RULE (carried from the spike): never
 * share a single material INSTANCE across two views with different tone
 * mappings — build a fresh material per view.
 */
export function ToneMapping({
  mode,
  exposure = 1,
  priority,
}: {
  mode: THREE.ToneMapping;
  /** Per-view exposure. A renderer uniform (not a program-cache key), so
   *  switching it per view is safe; defaults to 1. */
  exposure?: number;
  /** The owning View's `index - 1`. */
  priority: number;
}) {
  // Mutate gl through the useFrame `state` arg (a callback param, not a
  // hook-returned value) — the way drei's own View.js touches state.gl, which
  // keeps the react-hooks/immutability rule happy. Both toneMapping and
  // toneMappingExposure are renderer-level, so set together just before render.
  useFrame((state) => {
    state.gl.toneMapping = mode;
    state.gl.toneMappingExposure = exposure;
  }, priority);
  return null;
}

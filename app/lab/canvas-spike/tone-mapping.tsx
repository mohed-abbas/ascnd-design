"use client";

import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { spikeStats, type ViewName } from "./instrumentation";

/**
 * Per-view tone-mapping switch — the mechanism this Phase-0 spike exists to prove
 * (docs/canvas-consolidation-plan.md: the intro glass needs NoToneMapping, the
 * clouds' doc specifies ACES, and they must coexist on ONE shared renderer).
 *
 * Isolated in its own file so Phase 1 can swap the mechanism (e.g. a post-render
 * restore or an OutputPass) without touching the views.
 *
 * HOW IT WORKS — verified against the installed source:
 *  - drei's <View> Container renders its scissored viewport in a useFrame at
 *    priority = the View's `index` prop, and all portals share the root's ONE
 *    subscriber list (node_modules/@react-three/drei/web/View.js). So a setter
 *    placed inside a view at priority `index - 1` runs immediately BEFORE that
 *    view's render. Order per advance(): clear(1) → set(9) → glassRender(10) →
 *    set(19) → cloudsRender(20).
 *  - Runtime gl.toneMapping switching is SAFE on three r183: toneMapping is part
 *    of the program cache key (WebGLPrograms.js:347/469) and WebGLRenderer flags
 *    needsProgramChange only when a material's compiled toneMapping differs from
 *    the current one (WebGLRenderer.js ~2415). Because each material here is only
 *    ever rendered under ONE tone mapping, it compiles ONCE and never recompiles
 *    — no manual material.needsUpdate needed. The load-bearing rule: never share
 *    a single material INSTANCE across the two views (each view builds its own).
 *  - MeshTransmissionMaterial cooperates: its own useFrame saves gl.toneMapping,
 *    forces NoToneMapping around its FBO passes, and restores it
 *    (node_modules/@react-three/drei/core/MeshTransmissionMaterial.js:340-372), so
 *    it composes cleanly with this setter.
 */
export function ToneMapping({
  mode,
  priority,
  view,
}: {
  mode: THREE.ToneMapping;
  /** useFrame priority — set to the owning View's `index - 1`. */
  priority: number;
  view: ViewName;
}) {
  // Mutate gl through the useFrame `state` arg (a callback param, not a
  // hook-returned value) — the same way drei's own View.js touches state.gl, and
  // what keeps the react-hooks/immutability rule happy.
  useFrame((state) => {
    state.gl.toneMapping = mode;
    // Sample what THIS view is about to render under, for the HUD — proves the
    // glass view reports 0 (NoToneMapping) and the clouds view 4 (ACESFilmic).
    spikeStats.toneMapping[view] = state.gl.toneMapping;
  }, priority);
  return null;
}

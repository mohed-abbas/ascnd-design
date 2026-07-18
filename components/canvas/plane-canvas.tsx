"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { View } from "@react-three/drei";
import { Suspense, useEffect, useSyncExternalStore } from "react";
import { useQuality } from "@/lib/perf/use-quality";
import { PLANE_CONFIG, type PlaneName } from "./plane-config";
import {
  burstAll,
  bumpRemountKey,
  getDprOverride,
  getPlaneServerSnapshot,
  getPlaneSnapshot,
  getRemountKey,
  setVisible,
  subscribeDpr,
  subscribePlane,
  type ViewEntry,
} from "./view-registry";
import { ClearPass, Pump } from "./pump";
import { ToneMapping } from "./tone-mapping";

// Site-wide dpr ceiling (deliberate cap — every effect here is soft/blurred, so
// >1.5 buys nothing but fragments). The quality tier can only lower it.
const DPR_CAP = 1.5;

// Neutral shared camera (matches the Phase-0 spike, which rendered both the MTM
// glass and the drei clouds under it). Per-view cameras are a Phase-2+ extension
// to the descriptor if a migrant needs its own framing (drei <View> supports a
// `camera` prop); not needed for Phase 1 or the demo.
const CAMERA = { position: [0, 0, 8] as [number, number, number], fov: 45, near: 0.1, far: 100 };

/**
 * WebGL context-loss safety net for one plane. Ported from cloud-canvas.tsx: rely
 * on THREE's BUILT-IN webglcontextlost/restored handling — NO manual
 * preventDefault() (a documented anti-pattern that leaks across Fast Refresh).
 * On restore, burst every view (demand mode needs an explicit repaint). If a
 * restore never arrives within ~3s (unrecoverable driver reset) on a still-live,
 * visible canvas, bump the plane's remount key so the parent remounts the
 * <Canvas> with a fresh context. Registered views live OUTSIDE the Canvas (in the
 * registry), so they re-render automatically on remount.
 */
function ContextWatchdog({ plane }: { plane: PlaneName }) {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    let mounted = true;
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;

    const onLost = () => {
      // THREE already preventDefault()s and restores recoverable losses. Arm a
      // fallback only for a loss that never restores.
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = setTimeout(() => {
        if (mounted && canvas.isConnected && document.visibilityState === "visible") {
          bumpRemountKey(plane);
        }
      }, 3000);
    };
    const onRestored = () => {
      if (restoreTimer) clearTimeout(restoreTimer);
      restoreTimer = undefined;
      burstAll(plane, 4);
    };

    canvas.addEventListener("webglcontextlost", onLost, false);
    canvas.addEventListener("webglcontextrestored", onRestored, false);

    return () => {
      mounted = false;
      if (restoreTimer) clearTimeout(restoreTimer);
      canvas.removeEventListener("webglcontextlost", onLost, false);
      canvas.removeEventListener("webglcontextrestored", onRestored, false);
    };
  }, [gl, plane]);

  return null;
}

/**
 * One shared <Canvas> for one z-plane. Mounted by shared-canvas-host.tsx ONLY
 * while ≥1 view is registered on this plane (so a viewless plane costs nothing).
 * frameloop="never" — the Pump is the sole paint driver; invalidate() is a no-op
 * under "never" and appears nowhere. Each registered view renders as a drei
 * <View> (scissored to its placeholder rect) with its per-view <ToneMapping> at
 * priority index-1 and the caller's r3f children.
 */
export default function PlaneCanvas({ plane }: { plane: PlaneName }) {
  const cfg = PLANE_CONFIG[plane];

  const entries = useSyncExternalStore(
    (cb) => subscribePlane(plane, cb),
    () => getPlaneSnapshot(plane),
    getPlaneServerSnapshot,
  );
  const remountKey = useSyncExternalStore(
    (cb) => subscribePlane(plane, cb),
    () => getRemountKey(plane),
    () => 0,
  );
  const dprOverride = useSyncExternalStore(
    (cb) => subscribeDpr(plane, cb),
    () => getDprOverride(plane),
    () => null,
  );

  // dpr from the quality store, capped ≤1.5, further clamped by any per-plane
  // override (Phase 2's welcome dpr-1). Kept LIVE (re-applying dpr is cheap and
  // invisible — the mount-snapshot discipline is per-feature, e.g. cloudSegments).
  const { cloudDprMax } = useQuality();
  const dprMax = Math.min(DPR_CAP, cloudDprMax, dprOverride ?? Infinity);

  // Visibility gate: one IntersectionObserver per plane, owned by the host. Marks
  // each view visible/invisible from its placeholder rect so the pump idles to
  // zero when nothing is on screen. Re-runs when the registered set changes.
  useEffect(() => {
    const byEl = new Map<Element, string>();
    const io = new IntersectionObserver(
      (recs) => {
        for (const r of recs) {
          const id = byEl.get(r.target);
          if (id) setVisible(plane, id, r.isIntersecting);
        }
      },
      { threshold: 0 },
    );
    for (const e of entries) {
      const el = e.track.current;
      if (el) {
        byEl.set(el, e.id);
        io.observe(el);
      }
    }
    return () => io.disconnect();
  }, [plane, entries]);

  return (
    <Canvas
      key={remountKey}
      frameloop="never"
      dpr={[1, dprMax]}
      gl={{
        alpha: true,
        antialias: cfg.antialias,
        powerPreference: cfg.powerPreference,
      }}
      camera={CAMERA}
      // Inline style (not className): R3F sets inline styles on its container
      // that would override positioning classes — mirrors cloud-canvas.tsx.
      style={{
        position: "fixed",
        inset: 0,
        zIndex: cfg.zIndex,
        pointerEvents: cfg.pointerEvents,
      }}
    >
      <ClearPass />
      <Pump plane={plane} />
      {entries.map((e: ViewEntry) => (
        <View key={e.id} track={e.track as React.RefObject<HTMLElement>} index={e.index}>
          <ToneMapping
            mode={e.toneMapping}
            exposure={e.toneMappingExposure}
            priority={e.index - 1}
          />
          {/* PER-VIEW Suspense (M1): R3F wraps all Canvas children in ONE
              Suspense, so a single view suspending on an async asset (e.g. a
              texture) would blank EVERY view on the plane. A boundary per view
              makes fault isolation a host guarantee — one view's asset load can
              never blank its neighbours. */}
          <Suspense fallback={null}>{e.children}</Suspense>
        </View>
      ))}
      <ContextWatchdog plane={plane} />
    </Canvas>
  );
}

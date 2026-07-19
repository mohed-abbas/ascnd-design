"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { GlassView, CloudsView } from "./views";
import { ClearPass, Pump } from "./pump";
import { Hud } from "./hud";
import { patchGL, spikeStats, type ViewName } from "./instrumentation";

/**
 * Phase-0 canvas-consolidation spike (docs/canvas-consolidation-plan.md).
 *
 * ONE shared R3F <Canvas frameloop="never"> hosts TWO drei <View>s — a
 * NoToneMapping MTM glass object and an ACESFilmic drei <Clouds> field — each
 * tracking a placeholder <div> in the normal scroll flow. The whole page is
 * pumped by a single gsap.ticker-end advance() (Pump), and a DOM HUD reports the
 * three proofs live. See the sibling files for the mechanisms:
 *   views.tsx        — the two view scenes + per-view <ToneMapping>
 *   pump.tsx         — <ClearPass> (ghosting mitigation) + <Pump> (the advance loop)
 *   tone-mapping.tsx — the isolated per-view gl.toneMapping switch
 *   instrumentation.ts / hud.tsx — GL draw-call patch, counters, verdict overlay
 *
 * This island is dynamic-imported ssr:false (see page.tsx) — R3F can't SSR, and
 * the drei <View>s mount 3D children, so nothing here renders on the server.
 * Mounts within the root layout's LenisProvider (app/layout.tsx), so it inherits
 * the shared GSAP ticker the pump rides.
 */
export default function Spike() {
  const rootRef = useRef<HTMLDivElement>(null);
  const glassSlot = useRef<HTMLDivElement>(null);
  const cloudsSlot = useRef<HTMLDivElement>(null);
  const unpatch = useRef<(() => void) | null>(null);

  // Visibility gate: mark each view on/off screen from its placeholder rect, so
  // the pump can idle to zero when both are scrolled away. IntersectionObserver
  // (cheap, off the main scroll path) — the same element drei scissors to.
  useEffect(() => {
    const pairs: [HTMLDivElement | null, ViewName][] = [
      [glassSlot.current, "glass"],
      [cloudsSlot.current, "clouds"],
    ];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const name = (e.target as HTMLElement).dataset.view as ViewName;
          if (name) spikeStats.visible[name] = e.isIntersecting;
        }
      },
      { threshold: 0 },
    );
    for (const [el] of pairs) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);

  // Restore the patched GL draw methods on unmount (no leak across Fast Refresh).
  useEffect(() => () => unpatch.current?.(), []);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {/* Fixed shared canvas. pointer-events:none so scrolling passes through to
          the page (no picking needed in the spike); eventSource still bound to
          the page root per the Phase-0 brief. antialias:false + dpr≤1.5 + alpha
          per the shared-canvas policy. frameloop:never — only the pump paints. */}
      <Canvas
        frameloop="never"
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
        eventSource={rootRef as React.RefObject<HTMLElement>}
        camera={{ position: [0, 0, 8], fov: 45, near: 0.1, far: 100 }}
        style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 10 }}
        onCreated={({ gl }) => {
          // Count draw calls on THIS context (paint-burst instrumentation).
          unpatch.current = patchGL(gl.getContext());
        }}
      >
        <ClearPass />
        <Pump />
        {/* Views mounted DIRECTLY inside the Canvas (CanvasView branch) — no
            <View.Port> tunnel; that is only for Views rendered as DOM. */}
        <GlassView track={glassSlot} />
        <CloudsView track={cloudsSlot} />
      </Canvas>

      {/* Tall scroll page (~300vh). Two placeholder divs in normal flow — drei
          scissors each view to its rect, and the IntersectionObserver gates the
          pump off them. Scroll so BOTH clear the viewport to see idle-to-zero. */}
      <div style={{ height: "40vh" }} />
      <Slot label="VIEW A — glass · NoToneMapping (rotating MTM)" refEl={glassSlot} view="glass" />
      <div style={{ height: "60vh" }} />
      <Slot label="VIEW B — clouds · ACESFilmicToneMapping" refEl={cloudsSlot} view="clouds" />
      <div style={{ height: "120vh" }} />

      <Hud />
    </div>
  );
}

/** A framed placeholder the drei <View> tracks + the HUD gates on. */
function Slot({
  label,
  refEl,
  view,
}: {
  label: string;
  refEl: React.RefObject<HTMLDivElement | null>;
  view: ViewName;
}) {
  return (
    <div style={{ padding: "0 24px" }}>
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          font: "12px/1.4 ui-monospace, Menlo, monospace",
          color: "#0b1220",
          marginBottom: 8,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        ref={refEl}
        data-view={view}
        style={{
          maxWidth: 720,
          height: "70vh",
          margin: "0 auto",
          border: "1px solid rgba(11,18,32,0.35)",
          borderRadius: 12,
          // The 3D paints over this via the fixed canvas; the tint just frames
          // where the scissored view lands so the screenshot is legible.
          background: "rgba(255,255,255,0.06)",
        }}
      />
    </div>
  );
}

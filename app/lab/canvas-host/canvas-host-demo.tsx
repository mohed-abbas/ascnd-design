"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useSharedView } from "@/components/canvas/use-shared-view";
import { FRONT_INDEX } from "@/components/canvas/indices";
import { Hud } from "./hud";
import { BoxScene, CloudsScene, GlassScene } from "./scenes";

/**
 * /lab/canvas-host — Phase-1 verification artifact (docs/canvas-consolidation-
 * plan.md). Registers three views on the FRONT plane through the PRODUCTION host
 * (useSharedView) — this island renders NO <Canvas> of its own; the global
 * <SharedCanvasHost/> (app/layout.tsx) sees the front view count go > 0 and
 * mounts the front <Canvas>, scissoring each view to its placeholder div here.
 *
 * The three views exercise every pump path:
 *  - glass  — continuous, fpsCap null (uncapped → rides the display)
 *  - clouds — continuous, fpsCap "heavy" (60 on a fast panel; rides along uncapped
 *             glass when both are on screen — max-cap resolution)
 *  - box    — demand, fpsCap 30, dirtied from a scroll listener (dirty-flag +
 *             idle-to-zero + a numeric cap)
 * Dev-only: app/lab/layout.tsx 404s the whole /lab segment in production.
 */
export default function CanvasHostDemo() {
  const glassRef = useRef<HTMLDivElement>(null);
  const cloudsRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useSharedView({
    plane: "front",
    index: FRONT_INDEX.INTRO_TILES,
    track: glassRef,
    toneMapping: THREE.NoToneMapping,
    mode: "continuous",
    fpsCap: null,
    children: <GlassScene />,
  });

  useSharedView({
    plane: "front",
    index: FRONT_INDEX.ROCK_CLOUDS,
    track: cloudsRef,
    toneMapping: THREE.ACESFilmicToneMapping,
    mode: "continuous",
    fpsCap: "heavy",
    children: <CloudsScene />,
  });

  const box = useSharedView({
    plane: "front",
    index: FRONT_INDEX.FOOTER_GLASS,
    track: boxRef,
    toneMapping: THREE.NoToneMapping,
    mode: "demand",
    fpsCap: 30,
    children: <BoxScene />,
  });

  // Exercise requestBurst: paint the demand box a few frames on mount so it's
  // visible before any scroll (the InvalidateOnReady replacement).
  useEffect(() => {
    box.requestBurst(8);
  }, [box]);

  // Dirty the demand box on scroll → the pump advances (capped at 30) while
  // scrolling and idles to zero when it stops. Lenis drives the real window
  // scroll, so a plain scroll listener fires.
  useEffect(() => {
    const onScroll = () => box.markDirty();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [box]);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ height: "35vh" }} />
      <Slot label="VIEW A — glass · NoToneMapping · continuous / uncapped" refEl={glassRef} />
      <div style={{ height: "18vh" }} />
      <Slot label="VIEW B — clouds · ACESFilmic · continuous / heavy-cap" refEl={cloudsRef} />
      <div style={{ height: "120vh" }} />
      <Slot label="VIEW C — box · demand / cap 30 · dirtied on scroll" refEl={boxRef} />
      <div style={{ height: "120vh" }} />
      <Hud />
    </div>
  );
}

function Slot({ label, refEl }: { label: string; refEl: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div style={{ padding: "0 24px" }}>
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto 8px",
          font: "12px/1.4 ui-monospace, Menlo, monospace",
          color: "#0b1220",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        ref={refEl}
        style={{
          maxWidth: 720,
          height: "70vh",
          margin: "0 auto",
          border: "1px solid rgba(11,18,32,0.35)",
          borderRadius: 12,
          background: "rgba(255,255,255,0.06)",
        }}
      />
    </div>
  );
}

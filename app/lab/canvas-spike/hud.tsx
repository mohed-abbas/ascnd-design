"use client";

import { useEffect, useRef, useState } from "react";
import { spikeStats, anyVisible, TONE_NAMES, type ViewName } from "./instrumentation";

type Snapshot = {
  ticksPerSec: number;
  advancePerSec: number;
  drawsPerSec: number;
  burstsPerSec: number;
  toneMapping: Record<ViewName, number>;
  visible: Record<ViewName, boolean>;
  verdict: string;
  verdictColor: string;
};

const HUD_INTERVAL_MS = 500; // sample 2×/s

function toneLabel(v: number): string {
  if (v < 0) return "— (not yet rendered)";
  return `${TONE_NAMES[v] ?? "?"} (${v})`;
}

/**
 * DOM instrumentation overlay (top-left, monospace). Samples the spikeStats
 * singleton twice a second and derives per-second rates from the counter deltas.
 * DOM — not the canvas — so it keeps updating even when the canvas idles to zero.
 *
 * The three Phase-0 proofs it surfaces, all readable in a screenshot:
 *  1. Per-view tone mapping — "tone glass" vs "tone clouds" report 0 (No) and
 *     4 (ACESFilmic): different values, same renderer.
 *  2. Lockstep advance — ticks/s ≈ advance/s ≈ bursts/s → "LOCKSTEP OK"; a
 *     demand-mode half-rate defect would read bursts/s ≈ ½ ticks/s.
 *  3. Idle-to-zero — scroll both views off: advance/s + bursts/s → 0 while
 *     ticks/s holds ("IDLE — gate OK").
 * (MTM FBO isolation is a VISUAL proof — no red refracts through the glass —
 *  and the ghosting-mitigation clear is visual too; see the on-screen hints.)
 */
export function Hud() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  // Seeded in the effect (below), not here — performance.now() is impure and must
  // not run during render.
  const prev = useRef({ t: 0, ticks: 0, advance: 0, draws: 0, bursts: 0 });

  useEffect(() => {
    prev.current = {
      t: performance.now(),
      ticks: spikeStats.tickCount,
      advance: spikeStats.advanceCount,
      draws: spikeStats.drawCalls,
      bursts: spikeStats.paintBursts,
    };
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - prev.current.t) / 1000;
      if (dt <= 0) return;

      const ticksPerSec = (spikeStats.tickCount - prev.current.ticks) / dt;
      const advancePerSec = (spikeStats.advanceCount - prev.current.advance) / dt;
      const drawsPerSec = (spikeStats.drawCalls - prev.current.draws) / dt;
      const burstsPerSec = (spikeStats.paintBursts - prev.current.bursts) / dt;

      prev.current = {
        t: now,
        ticks: spikeStats.tickCount,
        advance: spikeStats.advanceCount,
        draws: spikeStats.drawCalls,
        bursts: spikeStats.paintBursts,
      };

      // Verdict.
      let verdict: string;
      let verdictColor: string;
      const on = anyVisible();
      if (!on || ticksPerSec < 1) {
        verdict = advancePerSec < 1 ? "IDLE — gate OK (0 advance)" : "IDLE?";
        verdictColor = "#7dd3fc";
      } else {
        const burstRatio = burstsPerSec / ticksPerSec;
        const advanceRatio = advancePerSec / ticksPerSec;
        if (burstRatio > 0.8 && advanceRatio > 0.8) {
          verdict = "LOCKSTEP OK";
          verdictColor = "#4ade80";
        } else if (burstRatio > 0.4 && burstRatio < 0.65) {
          verdict = "HALF-RATE DEFECT";
          verdictColor = "#f87171";
        } else {
          verdict = "UNSETTLED (see ratios)";
          verdictColor = "#fbbf24";
        }
      }

      setSnap({
        ticksPerSec,
        advancePerSec,
        drawsPerSec,
        burstsPerSec,
        toneMapping: { ...spikeStats.toneMapping },
        visible: { ...spikeStats.visible },
        verdict,
        verdictColor,
      });
    }, HUD_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const row = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        zIndex: 50,
        width: 340,
        padding: "12px 14px",
        borderRadius: 8,
        background: "rgba(8,12,24,0.82)",
        color: "#e5e7eb",
        font: "13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
        boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
        pointerEvents: "none",
        whiteSpace: "pre",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>canvas-spike · Phase 0</div>
      {snap ? (
        <>
          {row("ticker ticks/s", snap.ticksPerSec.toFixed(1))}
          {row("advance()/s", snap.advancePerSec.toFixed(1))}
          {row("draw calls/s", snap.drawsPerSec.toFixed(0))}
          {row("paint bursts/s", snap.burstsPerSec.toFixed(1))}
          <div style={{ height: 6 }} />
          {row("tone glass", toneLabel(snap.toneMapping.glass))}
          {row("tone clouds", toneLabel(snap.toneMapping.clouds))}
          <div style={{ height: 6 }} />
          {row(
            "views on screen",
            `${snap.visible.glass ? "glass " : ""}${snap.visible.clouds ? "clouds" : ""}`.trim() ||
              "none",
          )}
          <div style={{ height: 8 }} />
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: snap.verdictColor,
            }}
          >
            {snap.verdict}
          </div>
        </>
      ) : (
        <div style={{ opacity: 0.6 }}>sampling…</div>
      )}
      <div style={{ height: 8 }} />
      <div style={{ opacity: 0.55, fontSize: 11, whiteSpace: "normal" }}>
        Proofs: tone glass=0 (No) vs clouds=4 (ACES) · lockstep verdict · scroll
        both off → IDLE. Visual: no RED refracts through the glass (FBO isolation);
        the rotating glass leaves NO trails (the clear pass mitigates ghosting —
        delete ClearPass to see them).
      </div>
    </div>
  );
}

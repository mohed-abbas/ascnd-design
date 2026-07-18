"use client";

import { useEffect, useRef, useState } from "react";
import { getDebug } from "@/components/canvas/view-registry";

/**
 * DOM HUD for /lab/canvas-host. Reads the FRONT plane's live pump counters
 * (view-registry getDebug: ticks + advances, incremented inside the ticker pump)
 * and derives per-second rates. DOM, not the canvas, so it keeps updating even
 * when the canvas idles to zero.
 *
 * advance()/s IS the paint rate — advance() renders the whole canvas
 * unconditionally (one advance = one paint of every view), so no GL draw-call
 * patch is needed to prove painting. The proofs it surfaces:
 *  - LOCKSTEP: with glass (continuous, uncapped) + clouds (continuous, "heavy"
 *    cap) on the hero, advance/s ≈ ticks/s (≈ display rate) — the uncapped glass
 *    keeps the plane at the display rate and the capped clouds ride along, proving
 *    max-cap resolution (a capped view never drags an uncapped one down).
 *  - CAP: scroll down to the demand color box alone (cap 30). While scrolling,
 *    advance/s ≈ 30 (rate-limited by the accumulator). This is the demand path.
 *  - IDLE: stop scrolling with only the box on screen → advance/s → 0 while
 *    ticks/s holds (dirty flag cleared on paint; nothing re-sets it).
 */
const HUD_INTERVAL_MS = 500;

export function Hud() {
  const [snap, setSnap] = useState<{ ticks: number; advance: number; verdict: string; color: string } | null>(null);
  const prev = useRef({ t: 0, ticks: 0, advance: 0 });

  useEffect(() => {
    const dbg = getDebug("front");
    prev.current = { t: performance.now(), ticks: dbg.ticks, advance: dbg.advances };
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - prev.current.t) / 1000;
      if (dt <= 0) return;
      const ticks = (dbg.ticks - prev.current.ticks) / dt;
      const advance = (dbg.advances - prev.current.advance) / dt;
      prev.current = { t: now, ticks: dbg.ticks, advance: dbg.advances };

      let verdict: string;
      let color: string;
      if (ticks < 1) {
        verdict = "PLANE IDLE (no canvas / ticker parked)";
        color = "#7dd3fc";
      } else if (advance < 1) {
        verdict = "IDLE — gate OK (0 advance, ticker holding)";
        color = "#7dd3fc";
      } else if (advance / ticks > 0.8) {
        verdict = "LOCKSTEP OK (uncapped view rides display)";
        color = "#4ade80";
      } else {
        verdict = `CAPPED — advance ${advance.toFixed(0)}/s under ticks ${ticks.toFixed(0)}/s`;
        color = "#fbbf24";
      }
      setSnap({ ticks, advance, verdict, color });
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
        zIndex: 200,
        width: 360,
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
      <div style={{ fontWeight: 700, marginBottom: 6 }}>canvas-host · Phase 1 (FRONT plane)</div>
      {snap ? (
        <>
          {row("ticker ticks/s", snap.ticks.toFixed(1))}
          {row("advance()/s = paints/s", snap.advance.toFixed(1))}
          <div style={{ height: 8 }} />
          <div style={{ fontWeight: 700, fontSize: 14, color: snap.color, whiteSpace: "normal" }}>{snap.verdict}</div>
        </>
      ) : (
        <div style={{ opacity: 0.6 }}>sampling…</div>
      )}
      <div style={{ height: 8 }} />
      <div style={{ opacity: 0.55, fontSize: 11, whiteSpace: "normal" }}>
        Views (all FRONT, via the production host): glass continuous/uncapped ·
        clouds continuous/&quot;heavy&quot; · box demand/30. Hero: LOCKSTEP at display
        rate. Scroll to the box alone: advance ≈30 while scrolling, →0 when
        stopped (box freezes). Visual: no RED refracts through the glass (FBO
        isolation); the rotating glass leaves no trails (leading clear).
      </div>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";

// R3F can't SSR, and the spike mounts drei <View> 3D children — load the whole
// island client-only (mirrors /lab/glass and how CloudCanvas is mounted). ssr:false
// can't live in a Server Component in Next 16, so this client page composes it.
const Spike = dynamic(() => import("./spike"), { ssr: false });

/**
 * /lab/canvas-spike — Phase 0 of the canvas-consolidation plan
 * (docs/canvas-consolidation-plan.md). Dev-only (app/lab/layout.tsx 404s the whole
 * /lab segment in production). Proves, with an on-screen HUD: per-view tone
 * mapping (NoToneMapping glass + ACESFilmic clouds on one renderer), MTM FBO
 * scene isolation, and ticker-end advance() lockstep on a frameloop="never" canvas.
 */
export default function CanvasSpikePage() {
  return <Spike />;
}

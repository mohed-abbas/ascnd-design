"use client";

import dynamic from "next/dynamic";

// The demo island registers views that render 3D inside the shared host's
// <Canvas>; its scenes import three/drei, so load it client-only (ssr:false must
// live in a Client Component in Next 16). The host <Canvas> itself is mounted by
// app/layout.tsx and only spins up once this route registers front-plane views.
const CanvasHostDemo = dynamic(() => import("./canvas-host-demo"), { ssr: false });

/**
 * /lab/canvas-host — Phase 1 of the canvas-consolidation plan
 * (docs/canvas-consolidation-plan.md). Dev-only (app/lab/layout.tsx 404s /lab in
 * production). Drives the PRODUCTION shared-canvas host end-to-end: three views
 * registered via useSharedView on the FRONT plane, an on-screen HUD proving
 * ticker-end advance() lockstep, multi-view cap resolution, and demand/idle-to-
 * zero. Per-view tone mapping + MTM FBO isolation are the same visual proofs as
 * the Phase-0 spike, now routed through the real host.
 */
export default function CanvasHostPage() {
  return <CanvasHostDemo />;
}

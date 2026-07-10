"use client";

/**
 * PortfolioScene — client boundary that dynamically imports the WebGL canvas with
 * `ssr: false` (Next disallows `ssr:false` in a Server Component, so it must live
 * in a Client Component — same pattern as `components/background/cloud-layer.tsx`).
 * No device/WebGL gating here yet; that's a later (perf) pass.
 */
import dynamic from "next/dynamic";

const PortfolioCanvas = dynamic(() => import("./portfolio-canvas"), { ssr: false });

export default function PortfolioScene() {
  return <PortfolioCanvas />;
}

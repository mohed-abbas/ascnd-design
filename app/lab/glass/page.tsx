"use client";

import dynamic from "next/dynamic";

// R3F can't SSR — load the scene client-only (mirrors how CloudCanvas is mounted).
const GlassScene = dynamic(() => import("./glass-scene"), { ssr: false });

/**
 * /lab/glass — Phase-1 playground for tuning the liquid-glass "ascnd" material in
 * isolation. Not linked from anywhere; dev-only. Full-viewport canvas.
 */
export default function GlassLabPage() {
  return (
    <main className="fixed inset-0 h-dvh w-dvw">
      <GlassScene />
    </main>
  );
}

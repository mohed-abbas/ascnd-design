"use client";

import dynamic from "next/dynamic";

// R3F can't SSR — load the scene client-only (mirrors /lab/glass and CloudCanvas).
const CloudsScene = dynamic(() => import("./clouds-scene"), { ssr: false });

/**
 * /lab/clouds — playground for tuning the drei <Clouds>/<Cloud> sky in isolation,
 * with a live leva panel (seed, segments, volume, opacity, fade, growth, speed,
 * bounds, colour) and orbit controls. Not linked from anywhere; dev-only. This is
 * the drei "Clouds" reference scene the cloud ADR cites — a sandbox to dial in a
 * look before porting numbers back into components/background/cloud-canvas.tsx.
 */
export default function CloudsLabPage() {
  return (
    <main className="fixed inset-0 h-dvh w-dvw">
      <CloudsScene />
    </main>
  );
}

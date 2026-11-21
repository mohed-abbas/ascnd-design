"use client";

import dynamic from "next/dynamic";

// R3F can't SSR — load the scene client-only (mirrors /lab/clouds).
const SpriteCapture = dynamic(() => import("./sprite-capture"), { ssr: false });

/**
 * /lab/cloud-sprites — one-shot bake tool: renders every unique cloud recipe
 * from cloud-specs.ts in isolation and saves alpha-cropped transparent WebP
 * sprites to public/clouds/sprites/ (via the dev-only /api/lab/sprites writer).
 * These sprites feed the static mobile/no-WebGL cloud layer. Not linked from
 * anywhere; dev-only.
 */
export default function CloudSpritesLabPage() {
  return <SpriteCapture />;
}

"use client";

import dynamic from "next/dynamic";

/**
 * Dev-only tooling mount. A client component imported statically from the
 * (server) layout is bundled even when its JSX sits behind a NODE_ENV check —
 * the client-reference manifest keeps it. Resolving the import HERE, inside a
 * constant-folded NODE_ENV branch, lets the production build drop the dynamic
 * import (and the whole selector chunk) as dead code.
 */
const RockTreatmentSelector =
  process.env.NODE_ENV !== "production"
    ? dynamic(() => import("./rock-treatment-selector"), { ssr: false })
    : null;

export default function DevTools() {
  return RockTreatmentSelector ? <RockTreatmentSelector /> : null;
}

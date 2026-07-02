"use client";

import { useSyncExternalStore } from "react";
import CursorVisual from "./cursor-visual";

// A hover-morphing custom cursor is meaningful ONLY on a real mouse. Gate out
// touch / coarse-pointer / no-hover devices and small screens (the analog of
// cloud-layer.tsx's gate). Reduced-motion and low GPU tier do NOT gate here —
// the cursor still shows, it just stays a plain white disc (handled in
// cursor-visual.tsx), matching the stakeholder decision.
const HOVER = "(hover: hover)";
const FINE_POINTER = "(pointer: fine)";
const SMALL_SCREEN = "(max-width: 768px)";

function subscribe(callback: () => void) {
  const mqs = [
    window.matchMedia(HOVER),
    window.matchMedia(FINE_POINTER),
    window.matchMedia(SMALL_SCREEN),
  ];
  mqs.forEach((mq) => mq.addEventListener("change", callback));
  return () => mqs.forEach((mq) => mq.removeEventListener("change", callback));
}

function getSnapshot() {
  return (
    window.matchMedia(HOVER).matches &&
    window.matchMedia(FINE_POINTER).matches &&
    !window.matchMedia(SMALL_SCREEN).matches
  );
}

/**
 * Resolve whether the custom cursor should mount. Server snapshot is always
 * `false`, so SSR renders nothing (native cursor stays) and re-evaluates after
 * hydration — no mismatch — and it reacts live to a pointer/hover/breakpoint
 * change (e.g. plugging in a mouse, or a devtools device toggle). Mirrors
 * cloud-layer.tsx's gate.
 */
function useCursorEligible() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * Global custom cursor, mounted at the root (layout.tsx). This wrapper only
 * decides *whether* it mounts (real-mouse desktop); CursorVisual owns the
 * follow + glass morph. Required: no filter/backdrop-filter ancestor, or the
 * fixed element + its backdrop-filter break — hence the root mount.
 */
export default function Cursor() {
  if (!useCursorEligible()) return null;
  return <CursorVisual />;
}

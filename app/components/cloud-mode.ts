"use client";

import { useSyncExternalStore } from "react";

/**
 * Shared cloud-rendering mode — a tiny module store so the on-screen toggle
 * (`cloud-mode-toggle.tsx`) and the WebGL canvas (`cloud-canvas.tsx`, mounted
 * behind a `next/dynamic` boundary) can share one value without prop-drilling
 * or context plumbing. Same `useSyncExternalStore` shape as `cloud-layer.tsx`.
 *
 * Two looks, both documented in docs/cloud-color-and-lighting.md:
 * - "lit"  → Option 1: MeshLambertMaterial + a key light → bright, dimensional.
 * - "flat" → Option 2: MeshBasicMaterial (unlit) → flat, guaranteed-white, cheap.
 *
 * This is a visualization aid for sharing both options with the team; the choice
 * persists in localStorage. Default is "flat" (the chosen direction).
 */
export type CloudMode = "lit" | "flat";

const STORAGE_KEY = "ascnd:cloud-mode";

function readStored(): CloudMode {
  if (typeof window === "undefined") return "flat";
  return window.localStorage.getItem(STORAGE_KEY) === "lit" ? "lit" : "flat";
}

// Cached so getSnapshot returns a stable value (required by useSyncExternalStore).
let current: CloudMode = readStored();
const listeners = new Set<() => void>();

export function setCloudMode(mode: CloudMode) {
  if (mode === current) return;
  current = mode;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getSnapshot = () => current;
// SSR/hydration snapshot is always the default so server and first client render
// agree; useSyncExternalStore reconciles to the stored value right after.
const getServerSnapshot = (): CloudMode => "flat";

export function useCloudMode(): CloudMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

"use client";

import { useSyncExternalStore } from "react";

/**
 * Shared rock-entrance mode — a tiny module store (same shape as `cloud-mode.ts`)
 * so a future on-screen selector and the entrance orchestrator (`rock-entrance.tsx`)
 * can share one value without prop-drilling. Lets the team flip between the
 * entrance directions live and pick one; see docs/rock-entrance-animation.md.
 *
 * Three directions (only "rise" is implemented today — B and C land next):
 * - "rise"  → Option A: cliffs rise up out of the cloud sea (translateY 100→0).
 * - "slide" → Option B: cliffs slide in from the outer edges (xPercent ±100→0).
 * - "drift" → Option C: a subtle fade + small downward drift.
 *
 * Default is "rise" (the lead option). The choice persists in localStorage.
 */
export type RockEntrance = "rise" | "slide" | "drift";

const STORAGE_KEY = "ascnd:rock-entrance";
const DEFAULT: RockEntrance = "rise";

function readStored(): RockEntrance {
  if (typeof window === "undefined") return DEFAULT;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "slide" || v === "drift" ? v : DEFAULT;
}

// Cached so getSnapshot returns a stable value (required by useSyncExternalStore).
let current: RockEntrance = readStored();
const listeners = new Set<() => void>();

export function setRockEntrance(mode: RockEntrance) {
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
const getServerSnapshot = (): RockEntrance => DEFAULT;

export function useRockEntrance(): RockEntrance {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

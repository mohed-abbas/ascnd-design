"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { getMode, subscribeMode } from "@/lib/theme/mode-store";
import { CROSSFADE, PALETTES, type ThemeMode } from "@/lib/theme/palette";

/**
 * Drives the DOM sky recolour when the theme mode changes. Renders nothing.
 *
 * The sky gradient (background.tsx) is built from --sky-top/--sky-mid/--sky-bottom
 * plus --grain-opacity. This owns those variables IMPERATIVELY, straight from
 * PALETTES — so the sky is correct with or without the globals.css [data-mode]
 * rule (that rule is only a no-JS / first-paint fallback; inline style wins once
 * this has run):
 *   - on mount it SNAPS the vars to the real persisted mode, and
 *   - on a switch it GSAP-tweens them from the previous mode to the new one over
 *     CROSSFADE, leaving them resting on the target.
 *
 * It reads the store DIRECTLY (getMode/subscribeMode), NOT via the useMode hook.
 * useMode is backed by useSyncExternalStore, whose server snapshot is DEFAULT_MODE
 * ("day"); on the hydration render it returns "day" before flipping to the real
 * persisted value. Going through it made the mount effect snap DAY first and then
 * tween day→the real mode — a blue flash + transition on every non-day reload.
 * Reading getMode() at mount avoids that: the first application is the true mode.
 *
 * The cloud lights (cloud-canvas.tsx ThemeRig) animate on the SAME CROSSFADE, so
 * sky and clouds recolour in lockstep. Mount / reduced-motion SNAP; a plain
 * gsap.to() rides the shared ticker (LenisProvider), no private rAF, idle at rest.
 */

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const VARS = ["--sky-top", "--sky-mid", "--sky-bottom"] as const;

const stopsOf = (mode: ThemeMode) => {
  const s = PALETTES[mode].sky;
  return [s.top, s.mid, s.bottom] as const;
};

export default function ThemeDriver() {
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    // The last mode we applied. null until the first application, which SNAPS
    // (no entrance animation); every application after that tweens.
    let prev: ThemeMode | null = null;

    const setVars = (vals: readonly string[], grain: number) => {
      VARS.forEach((v, i) => html.style.setProperty(v, vals[i]));
      html.style.setProperty("--grain-opacity", String(grain));
    };

    const apply = () => {
      const mode = getMode();
      if (mode === prev) return;
      html.dataset.mode = mode;

      const to = stopsOf(mode);

      // First application, or reduced motion: snap the resting sky + grain.
      if (prev === null || window.matchMedia(REDUCE_MOTION).matches) {
        setVars(to, PALETTES[mode].grain);
        prev = mode;
        return;
      }

      tweenRef.current?.kill();

      // Tween from the outgoing palette to the new one, driving all stops off one
      // proxy so they share the ease/duration. gsap.utils.interpolate colour-blends
      // the hex strings; grain is a plain numeric lerp. The vars rest on the target
      // (inline wins over the globals.css [data-mode] rule).
      const from = stopsOf(prev);
      const lerp = VARS.map((_, i) => gsap.utils.interpolate(from[i], to[i]));
      const grainFrom = PALETTES[prev].grain;
      const grainTo = PALETTES[mode].grain;
      const proxy = { p: 0 };
      tweenRef.current = gsap.to(proxy, {
        p: 1,
        duration: CROSSFADE.duration,
        ease: CROSSFADE.ease,
        onUpdate: () =>
          setVars(
            VARS.map((_, i) => lerp[i](proxy.p)),
            grainFrom + (grainTo - grainFrom) * proxy.p,
          ),
      });
      prev = mode;
    };

    apply(); // snap to the real persisted mode on mount (no day flash)
    const unsubscribe = subscribeMode(apply);

    return () => {
      unsubscribe();
      tweenRef.current?.kill();
    };
  }, []);

  return null;
}

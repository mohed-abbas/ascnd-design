"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useMode } from "@/lib/theme/use-mode";
import { CROSSFADE, PALETTES, type ThemeMode } from "@/lib/theme/palette";

/**
 * Drives the DOM sky recolour when the theme mode changes. Renders nothing.
 *
 * The sky gradient (background.tsx) is built from --sky-top/--sky-mid/--sky-bottom.
 * This owns those variables IMPERATIVELY, straight from PALETTES — so the sky is
 * correct with or without the globals.css [data-mode] rule (that rule is only a
 * no-JS / first-paint fallback; inline style wins whenever this has run):
 *   - on mount it sets the three vars to the current mode's palette (no anim), and
 *   - on a switch it GSAP-tweens them from the PREVIOUS mode's palette to the new
 *     one over CROSSFADE, leaving them resting on the target.
 * `data-mode` is kept in sync for any styling keyed on it.
 *
 * The cloud lights (cloud-canvas.tsx ThemeRig) animate on the SAME CROSSFADE, so
 * sky and clouds recolour in lockstep.
 *
 * House-rules compliance:
 * - Rides GSAP's shared ticker (LenisProvider) — a plain gsap.to(), no private rAF.
 * - IDLES TO ZERO: only tweens during a switch; a settled page runs nothing (and
 *   it's a one-shot background recolour, not a per-frame effect).
 * - Mount / reduced-motion SNAP (no animation).
 */

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const VARS = ["--sky-top", "--sky-mid", "--sky-bottom"] as const;

const stopsOf = (mode: ThemeMode) => {
  const s = PALETTES[mode].sky;
  return [s.top, s.mid, s.bottom] as const;
};

export default function ThemeDriver() {
  const mode = useMode();
  const prevRef = useRef<ThemeMode | null>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.mode = mode;

    const to = stopsOf(mode);
    const setVars = (vals: readonly string[], grain: number) => {
      VARS.forEach((v, i) => html.style.setProperty(v, vals[i]));
      html.style.setProperty("--grain-opacity", String(grain));
    };

    const prev = prevRef.current;
    prevRef.current = mode;

    // First run, or reduced motion: snap the resting sky + grain to the target.
    if (prev === null || window.matchMedia(REDUCE_MOTION).matches) {
      setVars(to, PALETTES[mode].grain);
      return;
    }

    tweenRef.current?.kill();

    // Tween from the outgoing palette to the new one, driving all stops off one
    // proxy so they share the ease/duration. gsap.utils.interpolate colour-blends
    // the hex strings; grain is a plain numeric lerp. The vars rest on the target
    // after (inline wins over the globals.css [data-mode] rule).
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

    return () => {
      tweenRef.current?.kill();
    };
  }, [mode]);

  return null;
}

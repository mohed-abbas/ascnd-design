"use client";

/**
 * GlassSurface — Apple-style "liquid glass" via a chromatic per-channel SVG
 * displacement filter driven through `backdrop-filter`, so whatever is painted
 * BEHIND the element bends and disperses like real glass. Adapted from React Bits
 * (TypeScript + Tailwind variant).
 *
 * How it works: a data-URI SVG displacement map (a rounded-rect gradient, generated
 * to the element's live size) drives three `feDisplacementMap`s — one per R/G/B
 * channel, each offset slightly — recombined for chromatic aberration at the rim.
 * The real distortion is Chromium-only (Safari/Firefox are detected and fall back
 * to a plain frosted/tinted glass). `backdrop-filter` here is safe: the surface is
 * a sibling of the root-mounted fixed <Background/>, not an ancestor (CLAUDE.md).
 *
 * In this project it's used as an EMPTY pill laid over the "why teams stay" reel —
 * the scrolling text sits behind it and is refracted; no children are passed.
 *
 * ── DELIBERATE FORK (heavy-effect contract, CLAUDE.md) ─────────────────────
 * This file diverges from the React Bits original; keep these deltas when
 * updating from upstream (docs/why-stay-glass-optimization.md, Wave 1):
 * - SSR-stable first render: capability sniffing (CSS.supports / engine
 *   detection) lives in mounted state, never in the render path (audit H1).
 * - Displacement-map generation is deduped + debounced (upstream regenerated
 *   it 3× on mount and per resize tick) and measures layout size, not the
 *   transformed getBoundingClientRect.
 * - feGaussianBlur renders only when `displace > 0`; the identity
 *   `saturate(1)` is omitted from backdrop-filter.
 * - Reads the quality tier: tier `low` takes the frosted fallback instead of
 *   the 3-channel displacement chain (registered in lib/perf/tiers.ts).
 * ────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState, useId } from "react";
import { getTierName, subscribeQuality } from "@/lib/perf/quality-store";

export interface GlassSurfaceProps {
  children?: React.ReactNode;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  borderWidth?: number;
  brightness?: number;
  opacity?: number;
  blur?: number;
  displace?: number;
  backgroundOpacity?: number;
  saturation?: number;
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  xChannel?: "R" | "G" | "B";
  yChannel?: "R" | "G" | "B";
  mixBlendMode?:
    | "normal"
    | "multiply"
    | "screen"
    | "overlay"
    | "darken"
    | "lighten"
    | "color-dodge"
    | "color-burn"
    | "hard-light"
    | "soft-light"
    | "difference"
    | "exclusion"
    | "hue"
    | "saturation"
    | "color"
    | "luminosity"
    | "plus-darker"
    | "plus-lighter";
  className?: string;
  style?: React.CSSProperties;
}

const useDarkMode = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability read after mount
    setIsDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return isDark;
};

const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  width = 200,
  height = 80,
  borderRadius = 20,
  borderWidth = 0.07,
  brightness = 50,
  opacity = 0.93,
  blur = 11,
  displace = 0,
  backgroundOpacity = 0,
  saturation = 1,
  distortionScale = -180,
  redOffset = 0,
  greenOffset = 10,
  blueOffset = 20,
  xChannel = "R",
  yChannel = "G",
  mixBlendMode = "difference",
  className = "",
  style = {},
}) => {
  const uniqueId = useId().replace(/:/g, "-");
  const filterId = `glass-filter-${uniqueId}`;
  const redGradId = `red-grad-${uniqueId}`;
  const blueGradId = `blue-grad-${uniqueId}`;

  // Capability state — BOTH start false so SSR markup and the first client
  // render take the same (static fallback) branch, then upgrade after mount.
  // Sniffing these during render was the audit's H1 hydration mismatch: the
  // server can't run CSS.supports, so its branch never matched the client's.
  const [svgSupported, setSvgSupported] = useState<boolean>(false);
  const [backdropSupported, setBackdropSupported] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const feImageRef = useRef<SVGFEImageElement>(null);
  const redChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const greenChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const blueChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const gaussianBlurRef = useRef<SVGFEGaussianBlurElement>(null);

  const isDarkMode = useDarkMode();

  // Quality tier (lib/perf) — the displacement chain is the page's heaviest
  // per-frame filter and, unlike the canvases, has NO dpr/resolution knob to
  // turn down. So `low` takes the frosted fallback below (a compositor-
  // accelerated blur — the same glass Safari/Firefox already get).
  //
  // LATCHED, never live (stakeholder decision, 2026-07-02): the material must
  // NEVER swap while the user can see it — a watchdog step-down would fire
  // exactly during the pinned scrub, trading the liquid glass for frost in
  // front of the user's eyes. So the gate follows the store only while the
  // pill is far off-screen (tier boot resolves async ~300ms into the session,
  // long before the fold is reached) and FREEZES for good as the pill
  // approaches the viewport. A weak machine shows frost from its very first
  // appearance (it never saw glass, so nothing downgrades); everyone else
  // keeps the displacement for the whole session. `?tier=` A/B still works —
  // it forces synchronously at boot, before the latch can engage.
  const [tierFrost, setTierFrost] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    const apply = () => setTierFrost(getTierName() === "low");
    apply();
    let unsubscribe: (() => void) | undefined = subscribeQuality(apply);
    const stopTracking = () => {
      unsubscribe?.();
      unsubscribe = undefined;
    };
    let io: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== "undefined") {
      // Freeze half a viewport early so the branch can't flip mid-entrance.
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            stopTracking();
            io?.disconnect();
            io = undefined;
          }
        },
        { rootMargin: "50% 0% 50% 0%" },
      );
      io.observe(el);
    }
    return () => {
      stopTracking();
      io?.disconnect();
    };
  }, []);

  const displacementActive = svgSupported && !tierFrost;

  const generateDisplacementMap = () => {
    // Layout size, NOT getBoundingClientRect: the why-stay entrance animates
    // the pill's wrapper from scale 0.96, and gBCR bakes that transform into
    // the map's aspect (the reveal arms the scale in a layout effect, before
    // this ever runs). offsetWidth/Height are transform-independent.
    const actualWidth = containerRef.current?.offsetWidth || 400;
    const actualHeight = containerRef.current?.offsetHeight || 200;
    const edgeSize = Math.min(actualWidth, actualHeight) * (borderWidth * 0.5);

    const svgContent = `
      <svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="red"/>
          </linearGradient>
          <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" fill="black"></rect>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${redGradId})" />
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode: ${mixBlendMode}" />
        <rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${borderRadius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)" />
      </svg>
    `;

    return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
  };

  // Regeneration is EXPENSIVE relative to what it looks like: the data-URI is
  // an SVG the feImage must re-decode and re-rasterize INCLUDING its baked
  // blur(12px). Upstream regenerated it 3× on mount (two effects + the
  // ResizeObserver's initial fire) and on every resize tick — dedupe on the
  // inputs so identical maps are never rebuilt.
  const lastMapKeyRef = useRef<string>("");
  const updateDisplacementMap = () => {
    const w = containerRef.current?.offsetWidth || 400;
    const h = containerRef.current?.offsetHeight || 200;
    const key = [w, h, borderRadius, borderWidth, brightness, opacity, blur, mixBlendMode].join("|");
    if (key === lastMapKeyRef.current) return;
    lastMapKeyRef.current = key;
    feImageRef.current?.setAttribute("href", generateDisplacementMap());
  };

  const supportsSVGFilters = () => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return false;
    }

    const isWebkit =
      /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    // Detect Gecko by an engine-only DOM property rather than the UA string:
    // privacy browsers (e.g. Zen) spoof "Firefox" out of navigator.userAgent,
    // but `MozAppearance` only exists on Gecko. Gecko renders the feImage +
    // feDisplacementMap backdrop combo incorrectly, so it must take the CSS
    // fallback regardless of what UA it reports.
    const isFirefox =
      /Firefox/.test(navigator.userAgent) ||
      "MozAppearance" in document.documentElement.style;

    if (isWebkit || isFirefox) {
      return false;
    }

    const div = document.createElement("div");
    div.style.backdropFilter = `url(#${filterId})`;

    return div.style.backdropFilter !== "";
  };

  useEffect(() => {
    updateDisplacementMap();
    [
      { ref: redChannelRef, offset: redOffset },
      { ref: greenChannelRef, offset: greenOffset },
      { ref: blueChannelRef, offset: blueOffset },
    ].forEach(({ ref, offset }) => {
      if (ref.current) {
        ref.current.setAttribute("scale", (distortionScale + offset).toString());
        ref.current.setAttribute("xChannelSelector", xChannel);
        ref.current.setAttribute("yChannelSelector", yChannel);
      }
    });

    gaussianBlurRef.current?.setAttribute("stdDeviation", displace.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    width,
    height,
    borderRadius,
    borderWidth,
    brightness,
    opacity,
    blur,
    displace,
    distortionScale,
    redOffset,
    greenOffset,
    blueOffset,
    xChannel,
    yChannel,
    mixBlendMode,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability read after mount
    setSvgSupported(supportsSVGFilters());
    setBackdropSupported(CSS.supports("backdrop-filter", "blur(10px)"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Trailing debounce: a live resize fires the observer per tick, and each
    // regeneration is a full SVG re-raster (see updateDisplacementMap) — only
    // the settled size matters. The dedupe key above also drops the
    // observer's initial fire (the mount effect already built that map).
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(updateDisplacementMap, 100);
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(debounce);
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getContainerStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      ...style,
      width: typeof width === "number" ? `${width}px` : width,
      height: typeof height === "number" ? `${height}px` : height,
      borderRadius: `${borderRadius}px`,
      "--glass-frost": backgroundOpacity,
      "--glass-saturation": saturation,
    } as React.CSSProperties;

    // Mounted state, not a live sniff — render must stay SSR-stable (H1).
    const backdropFilterSupported = backdropSupported;

    if (displacementActive) {
      return {
        ...baseStyles,
        background: isDarkMode
          ? `hsl(0 0% 0% / ${backgroundOpacity})`
          : `hsl(0 0% 100% / ${backgroundOpacity})`,
        // saturate(1) is an identity op but still costs a filter stage per
        // evaluation — only append it when it actually does something.
        backdropFilter:
          saturation === 1
            ? `url(#${filterId})`
            : `url(#${filterId}) saturate(${saturation})`,
        boxShadow: isDarkMode
          ? `0 0 2px 1px color-mix(in oklch, white, transparent 65%) inset,
             0 0 10px 4px color-mix(in oklch, white, transparent 85%) inset,
             0px 4px 16px rgba(17, 17, 26, 0.05),
             0px 8px 24px rgba(17, 17, 26, 0.05),
             0px 16px 56px rgba(17, 17, 26, 0.05),
             0px 4px 16px rgba(17, 17, 26, 0.05) inset,
             0px 8px 24px rgba(17, 17, 26, 0.05) inset,
             0px 16px 56px rgba(17, 17, 26, 0.05) inset`
          : `0 0 2px 1px color-mix(in oklch, black, transparent 85%) inset,
             0 0 10px 4px color-mix(in oklch, black, transparent 90%) inset,
             0px 4px 16px rgba(17, 17, 26, 0.05),
             0px 8px 24px rgba(17, 17, 26, 0.05),
             0px 16px 56px rgba(17, 17, 26, 0.05),
             0px 4px 16px rgba(17, 17, 26, 0.05) inset,
             0px 8px 24px rgba(17, 17, 26, 0.05) inset,
             0px 16px 56px rgba(17, 17, 26, 0.05) inset`,
      };
    }

    if (isDarkMode) {
      if (!backdropFilterSupported) {
        return {
          ...baseStyles,
          background: "rgba(0, 0, 0, 0.4)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: `inset 0 1px 0 0 rgba(255, 255, 255, 0.2),
                      inset 0 -1px 0 0 rgba(255, 255, 255, 0.1)`,
        };
      }
      return {
        ...baseStyles,
        background: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(12px) saturate(1.8) brightness(1.2)",
        WebkitBackdropFilter: "blur(12px) saturate(1.8) brightness(1.2)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        boxShadow: `inset 0 1px 0 0 rgba(255, 255, 255, 0.2),
                    inset 0 -1px 0 0 rgba(255, 255, 255, 0.1)`,
      };
    }

    if (!backdropFilterSupported) {
      return {
        ...baseStyles,
        background: "rgba(255, 255, 255, 0.4)",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        boxShadow: `inset 0 1px 0 0 rgba(255, 255, 255, 0.5),
                    inset 0 -1px 0 0 rgba(255, 255, 255, 0.3)`,
      };
    }
    // Frosted-glass fallback (Firefox/Safari): the chromatic displacement
    // filter is unavailable on these engines, so we can't refract the reel.
    // The next-best "glass" is a genuine frost — enough blur that the big
    // bright reel text melts into a smooth, even wash (reads as intentional)
    // rather than the legible smears a light blur leaves behind. Saturation is
    // kept near 1 so the blue sky isn't pushed into a vivid "blue bar", and a
    // white body + rim highlights sell the pill edge.
    return {
      ...baseStyles,
      background: "rgba(255, 255, 255, 0.14)",
      backdropFilter: "blur(22px) saturate(1.05) brightness(1.06)",
      WebkitBackdropFilter: "blur(22px) saturate(1.05) brightness(1.06)",
      border: "1px solid rgba(255, 255, 255, 0.5)",
      boxShadow: `0 8px 32px 0 rgba(31, 38, 135, 0.15),
                  inset 0 1px 1px 0 rgba(255, 255, 255, 0.75),
                  inset 0 -1px 1px 0 rgba(255, 255, 255, 0.3),
                  inset 0 0 30px 0 rgba(255, 255, 255, 0.14)`,
    };
  };

  const glassSurfaceClasses =
    "relative flex items-center justify-center overflow-hidden transition-opacity duration-[260ms] ease-out";

  const focusVisibleClasses = isDarkMode
    ? "focus-visible:outline-2 focus-visible:outline-[#0A84FF] focus-visible:outline-offset-2"
    : "focus-visible:outline-2 focus-visible:outline-[#007AFF] focus-visible:outline-offset-2";

  return (
    <div
      ref={containerRef}
      className={`${glassSurfaceClasses} ${focusVisibleClasses} ${className}`}
      style={getContainerStyles()}
    >
      <svg
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter
            id={filterId}
            colorInterpolationFilters="sRGB"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
          >
            <feImage
              ref={feImageRef}
              x="0"
              y="0"
              width="100%"
              height="100%"
              preserveAspectRatio="none"
              result="map"
            />

            <feDisplacementMap
              ref={redChannelRef}
              in="SourceGraphic"
              in2="map"
              id="redchannel"
              result="dispRed"
            />
            <feColorMatrix
              in="dispRed"
              type="matrix"
              values="1 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="red"
            />

            <feDisplacementMap
              ref={greenChannelRef}
              in="SourceGraphic"
              in2="map"
              id="greenchannel"
              result="dispGreen"
            />
            <feColorMatrix
              in="dispGreen"
              type="matrix"
              values="0 0 0 0 0
                      0 1 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
              result="green"
            />

            <feDisplacementMap
              ref={blueChannelRef}
              in="SourceGraphic"
              in2="map"
              id="bluechannel"
              result="dispBlue"
            />
            <feColorMatrix
              in="dispBlue"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 1 0 0
                      0 0 0 1 0"
              result="blue"
            />

            <feBlend in="red" in2="green" mode="screen" result="rg" />
            <feBlend in="rg" in2="blue" mode="screen" result="output" />
            {/* A full-region convolution pass per evaluation — only mount it
                when a soften is actually requested. At displace 0 the last
                feBlend is the filter output. If rim jaggies ever need
                softening, bake blur into the displacement map instead (that
                raster is one-time, not per-frame). */}
            {displace > 0 && (
              <feGaussianBlur
                ref={gaussianBlurRef}
                in="output"
                stdDeviation={displace}
              />
            )}
          </filter>
        </defs>
      </svg>

      <div className="relative z-10 flex h-full w-full items-center justify-center rounded-[inherit] p-2">
        {children}
      </div>
    </div>
  );
};

export default GlassSurface;

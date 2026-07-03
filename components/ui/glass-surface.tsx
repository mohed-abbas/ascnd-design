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
 * to a clear glass: rim + static chromatic ring, no backdrop-filter).
 * `backdrop-filter` here is safe: the surface is
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
 * - `chromatic={false}` (report O3) collapses the chain to ONE
 *   feDisplacementMap (~⅓ the filter cost): no per-channel split, the
 *   chromatic rim becomes a static gradient ring instead of live dispersion.
 *   The sole consumer (the why-teams-stay pill) passes `chromatic={false}` on
 *   every tier for max, uniform fps (docs/why-stay-glass-optimization.md
 *   Decision 6). The 3-channel branch below is retained for genericity — this
 *   component no longer reads the quality tier itself (it once forced the
 *   single-map variant on tier `low`; that gate is gone now the caller opts in
 *   directly).
 * ────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useRef, useState, useId } from "react";

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
  /**
   * true (default) = the original 3-channel chain: one feDisplacementMap per
   * R/G/B at slightly different scales, screen-blended → live chromatic
   * dispersion that moves with the refracted content. false = ONE
   * feDisplacementMap at the mean scale (~⅓ the per-frame filter cost) plus a
   * static chromatic gradient ring on the pill edge (report O3).
   */
  chromatic?: boolean;
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
  chromatic = true,
  mixBlendMode = "difference",
  className = "",
  style = {},
}) => {
  const uniqueId = useId().replace(/:/g, "-");
  const filterId = `glass-filter-${uniqueId}`;
  const redGradId = `red-grad-${uniqueId}`;
  const blueGradId = `blue-grad-${uniqueId}`;

  // Capability state — starts false so SSR markup and the first client render
  // take the same (clear glass) branch, then upgrades after mount. Sniffing
  // during render was the audit's H1 hydration mismatch: the server can't run
  // engine detection, so its branch never matched the client's.
  const [svgSupported, setSvgSupported] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const feImageRef = useRef<SVGFEImageElement>(null);
  const redChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const greenChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const blueChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const singleChannelRef = useRef<SVGFEDisplacementMapElement>(null);
  const gaussianBlurRef = useRef<SVGFEGaussianBlurElement>(null);

  const isDarkMode = useDarkMode();

  // The `chromatic` prop alone selects the chain: true = 3-channel per-channel
  // dispersion, false = ONE feDisplacementMap + a static chromatic ring
  // (~⅓ the per-frame filter cost). The sole consumer passes `chromatic={false}`
  // on every tier (docs/why-stay-glass-optimization.md Decision 6), so this
  // component no longer reads the quality tier itself — the caller opts into the
  // cheaper variant directly. (Historically tier `low` forced single-map via a
  // viewport-latched store read; that gate is gone.)
  const effectiveChromatic = chromatic;
  const displacementActive = svgSupported;

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
    const channels = effectiveChromatic
      ? [
          { ref: redChannelRef, offset: redOffset },
          { ref: greenChannelRef, offset: greenOffset },
          { ref: blueChannelRef, offset: blueOffset },
        ]
      : [
          // Single map at the mean of the three channel scales, so the bend
          // geometry matches the chromatic variant's perceptual centre.
          {
            ref: singleChannelRef,
            offset: (redOffset + greenOffset + blueOffset) / 3,
          },
        ];
    channels.forEach(({ ref, offset }) => {
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
    effectiveChromatic,
    mixBlendMode,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time capability read after mount
    setSvgSupported(supportsSVGFilters());
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

    // EVERY non-displacement path is the same clear glass — Gecko/Safari
    // (the displacement filter renders incorrectly there), the SSR/pre-mount
    // frame, ancient no-backdrop-filter browsers, dark-mode OSes. The
    // vendored fallback ladder (dark/light frosts, blur 12–22px) is GONE:
    // the stakeholder rejected frost in every form — over the bright reel on
    // the blue sky it reads as a milky blue bar. Clear glass = transparent
    // body + crisp rim + the static chromatic ring below, NO backdrop-filter
    // anywhere. The framed phrase stays sharp through the pill (which is what
    // the design frames anyway), it matches the Chromium tiers' family, and
    // it costs zero per frame on any engine.
    return {
      ...baseStyles,
      background: "rgba(255, 255, 255, 0.1)",
      border: "1px solid rgba(255, 255, 255, 0.55)",
      boxShadow: `0 8px 32px 0 rgba(31, 38, 135, 0.12),
                  inset 0 1px 1px 0 rgba(255, 255, 255, 0.75),
                  inset 0 -1px 1px 0 rgba(255, 255, 255, 0.35),
                  inset 0 0 24px 0 rgba(255, 255, 255, 0.12)`,
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

            {effectiveChromatic ? (
              <>
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
              </>
            ) : (
              /* O3: one displacement, no channel split — the whole per-frame
                 chain is feImage + this + (optional) blur. */
              <feDisplacementMap
                ref={singleChannelRef}
                in="SourceGraphic"
                in2="map"
                result="output"
              />
            )}
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

      {/* Static chromatic ring — stands in for the live per-channel rim
          dispersion wherever the full chromatic chain isn't running (the
          single-map variant, and the Gecko/Safari clear-glass fallback).
          COOL at both ends (stakeholder call: a warm pink start read as a
          purplish smudge on the left rim — both sides now match the cyan
          cast of the right). Masked 1px ring; pure composited paint, costs
          nothing per frame. */}
      {!(displacementActive && effectiveChromatic) && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            padding: 1.5,
            background:
              "linear-gradient(125deg, rgba(120,215,255,0.45), rgba(255,255,255,0) 30% 70%, rgba(90,220,255,0.55))",
            WebkitMask:
              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
      )}
      <div className="relative z-10 flex h-full w-full items-center justify-center rounded-[inherit] p-2">
        {children}
      </div>
    </div>
  );
};

export default GlassSurface;

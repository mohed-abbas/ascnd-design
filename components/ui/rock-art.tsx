"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import {
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { CROSSFADE } from "@/lib/theme/palette";
import { bakedModesFor } from "@/lib/theme/rock-treatment";
import { useMode } from "@/lib/theme/use-mode";
import { useRockTreatment } from "@/lib/theme/use-rock-treatment";

/**
 * The layer stack every 2D rock draws through, so the rock mode-adaptation
 * treatments (lib/theme/rock-treatment.ts, docs/rocks-by-mode.html) apply to
 * the hero cliffs, their grass overlays and the footer rocks alike:
 *
 *   <svg>            B's tint filter (only when tinted), a 0×0 sibling
 *   [data-rock-art]  isolated group — A's CSS filter, or B's SVG tint filter
 *                    (globals.css), lands here
 *     children       the caller's own base <Image> (unchanged priority/sizes)
 *     .rock-bake ×n  C: pre-graded copies (`<name>.<mode>.<ext>`), opacity-
 *                    crossfaded by CSS on <html data-mode>
 *
 * B multiplies the rock's colour by a sky-tinted top→bottom gradient and keeps
 * its alpha exactly. It used to be a `mix-blend-mode: multiply` span masked to
 * the rock's alpha, but a CSS multiply over a semi-transparent pixel can't keep
 * alpha: where the backdrop is see-through it paints the span's own colour
 * instead. That left a white (day) / blue (night) film on every soft edge, and
 * the grass overlays are almost all soft edge. The SVG filter computes
 * (rgb·tint, a) per pixel with feComposite arithmetic, which has no such term.
 *
 * `kind` says what the art is — a bare rock, or grass (the hover overlays and the
 * grass-topped footer rock). The "split" treatment reads it (A's filter on
 * rocks, B's tint on grass), and so does "relight" (B's tint on grass; bare
 * rocks that pass `relight` maps are drawn by <RelitRock>, the rest filtered).
 *
 * <RelitRock> only mounts where it changes pixels (useRelightActive): day is
 * the identity, and the hero cliffs are hidden below md. Day and mobile get
 * the plain <img> (A's filter, which is the identity in day), so they never
 * download the relight maps or create a WebGL context.
 *
 * The tint and bake layers only MOUNT under a treatment that uses them, so the
 * default ("none") renders the same single <img> as before and downloads no
 * extra bytes. `fit` mirrors how the base image fills its box: "height" (hero:
 * h-full w-auto, the box IS the image) or "cover" (footer: fill + object-cover,
 * so the tint mask and bakes cover-crop the same way).
 */

type BakeMode = "sunrise" | "sunset" | "night";

// WebGL relight canvas — only fetched when the "relight" treatment is picked.
const RelitRock = dynamic(() => import("./relit-rock"), { ssr: false });
// Same breakpoint as the cliffs' `max-md:hidden` (Tailwind v4 md = 48rem).
const DESKTOP = "(min-width: 48rem)";
function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia(DESKTOP);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Whether <RelitRock> should be mounted: it's wanted, the screen is desktop
 * width, and the mode isn't day. On a switch INTO day it stays mounted for one
 * crossfade, so the canvas can tween to the day lights (the identity) and then
 * unmount onto an identical <img> instead of snapping. Server snapshot false:
 * SSR renders the plain <img>, the canvas mounts after hydration.
 */
function useRelightActive(wanted: boolean): boolean {
  const mode = useMode();
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
  const lit = wanted && desktop && mode !== "day";
  const [prevLit, setPrevLit] = useState(lit);
  const [linger, setLinger] = useState(false);
  if (lit !== prevLit) {
    setPrevLit(lit);
    setLinger(!lit && wanted && desktop);
  }
  useEffect(() => {
    if (!linger) return;
    const id = window.setTimeout(() => setLinger(false), CROSSFADE.duration * 1000 + 100);
    return () => window.clearTimeout(id);
  }, [linger]);
  return lit || linger;
}


export default function RockArt({
  src,
  sizes,
  fit = "height",
  kind = "rock",
  relight,
  className = "",
  children,
}: {
  /** The base image — also the tint's alpha mask and the bake files' stem. */
  src: string;
  sizes: string;
  fit?: "height" | "cover";
  kind?: "rock" | "grass";
  /** 2.5D relight inputs (hero cliffs only): the `<name>.relight.webp` map and
   *  which side the cliff is on. Used by the "relight" treatment. */
  relight?: { map: string; side: "left" | "right" };
  className?: string;
  children: ReactNode;
}) {
  const treatment = useRockTreatment();
  const tinted =
    treatment === "tint" ||
    treatment === "tint-night" ||
    ((treatment === "split" || treatment === "relight") && kind === "grass");
  const relit = useRelightActive(treatment === "relight" && kind === "rock" && !!relight);
  const bakes = bakedModesFor(treatment);
  const tintId = `rock-tint${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <>
      {tinted && <RockTintFilter id={tintId} />}
      <div
        data-rock-art
        data-rock-fit={fit}
        data-rock-kind={kind}
        data-relit={relit ? "" : undefined}
        data-rock-tinted={tinted ? "" : undefined}
        style={tinted ? ({ "--rock-tint-ref": `url(#${tintId})` } as CSSProperties) : undefined}
        className={className}
      >
        {children}
        {relit && relight && <RelitRock src={src} map={relight.map} side={relight.side} />}
        {bakes.map((mode: BakeMode) => (
          <Image
            key={mode}
            data-bake-mode={mode}
            src={src.replace(/\.(avif|png)$/, `.${mode}.$1`)}
            alt=""
            fill
            unoptimized
            sizes={sizes}
            className="rock-bake object-cover"
          />
        ))}
      </div>
    </>
  );
}

// B's gradient ramp: black at the top of the box → white at the bottom, a
// static image the filter stretches over the rock's box and uses to mix the
// two tint colours (which are live CSS vars, so they can't go in here).
const TINT_RAMP = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="64" viewBox="0 0 1 64" preserveAspectRatio="none"><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient><rect width="1" height="64" fill="url(#g)"/></svg>',
)}`;

const tintFlood = (v: "top" | "bottom"): CSSProperties => ({
  floodColor: `var(--rock-tint-${v}, #fff)`,
});

/**
 * B's tint as an SVG filter: out = (rgb · tint, a), with
 *   tint = mix(--rock-tint-top, --rock-tint-bottom, ramp)
 * computed in sRGB, as the old multiply span did. The floods read ThemeDriver's
 * vars, so the tint crossfades with the sky on its own. feComposite arithmetic
 * works on premultiplied values: (rgb·a) · tint = (rgb·tint)·a, and the alpha
 * channel comes out as a · 1, so soft edges keep exactly their own alpha.
 */
function RockTintFilter({ id }: { id: string }) {
  return (
    <svg aria-hidden width="0" height="0" className="pointer-events-none absolute">
      <filter
        id={id}
        x="0"
        y="0"
        width="1"
        height="1"
        colorInterpolationFilters="sRGB"
      >
        <feImage href={TINT_RAMP} preserveAspectRatio="none" result="ramp" />
        <feFlood style={tintFlood("top")} result="top" />
        <feFlood style={tintFlood("bottom")} result="bottom" />
        <feComposite in="bottom" in2="ramp" operator="arithmetic" k1="1" result="b" />
        <feComponentTransfer in="ramp" result="inv">
          <feFuncR type="linear" slope="-1" intercept="1" />
          <feFuncG type="linear" slope="-1" intercept="1" />
          <feFuncB type="linear" slope="-1" intercept="1" />
        </feComponentTransfer>
        <feComposite in="top" in2="inv" operator="arithmetic" k1="1" result="t" />
        <feComposite in="b" in2="t" operator="arithmetic" k2="1" k3="1" result="tint" />
        <feComposite in="SourceGraphic" in2="tint" operator="arithmetic" k1="1" />
      </filter>
    </svg>
  );
}

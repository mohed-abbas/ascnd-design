"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { bakedModesFor } from "@/lib/theme/rock-treatment";
import { useRockTreatment } from "@/lib/theme/use-rock-treatment";

/**
 * The layer stack every 2D rock draws through, so the rock mode-adaptation
 * treatments (lib/theme/rock-treatment.ts, docs/rocks-by-mode.html) apply to
 * the hero cliffs, their grass overlays and the footer rocks alike:
 *
 *   [data-rock-art]  isolated group — A's filter lands here (globals.css)
 *     children       the caller's own base <Image> (unchanged priority/sizes)
 *     .rock-tint     B: a sky-tinted gradient, masked to the rock's own alpha,
 *                    multiplied over the base INSIDE the isolated group — so it
 *                    darkens only the rock, never the sky or clouds behind it
 *     .rock-bake ×n  C: pre-graded copies (`<name>.<mode>.<ext>`), opacity-
 *                    crossfaded by CSS on <html data-mode>
 *
 * `kind` says what the art is — a bare rock, or grass (the hover overlays and the
 * grass-topped footer rock). The "split" treatment reads it (A's filter on
 * rocks, B's tint on grass), and so does "relight" (B's tint on grass; bare
 * rocks that pass `relight` maps are drawn by <RelitRock>, the rest filtered).
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
  const relit = treatment === "relight" && kind === "rock" && !!relight;
  const bakes = bakedModesFor(treatment);
  const mask = `url(${src})`;

  return (
    <div
      data-rock-art
      data-rock-fit={fit}
      data-rock-kind={kind}
      data-relit={relit ? "" : undefined}
      className={className}
    >
      {children}
      {relit && relight && <RelitRock src={src} map={relight.map} side={relight.side} />}
      {tinted && (
        <span
          aria-hidden
          className="rock-tint"
          style={{ maskImage: mask, WebkitMaskImage: mask }}
        />
      )}
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
  );
}

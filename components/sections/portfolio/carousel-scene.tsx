"use client";

/**
 * CarouselScene — client boundary for the V3 carousel variants. Loads the WebGL
 * canvas via next/dynamic({ ssr:false }) (a Server Component can't set ssr:false)
 * and passes the arrangement `mode` through. The parent keys each variant, so a
 * mode change is a remount rather than an in-place switch.
 */
import dynamic from "next/dynamic";
import type { CarouselMode } from "./carousel/carousel-engine";

const CarouselCanvas = dynamic(() => import("./carousel-canvas"), { ssr: false });

export default function CarouselScene({ mode }: { mode: CarouselMode }) {
  return <CarouselCanvas mode={mode} />;
}

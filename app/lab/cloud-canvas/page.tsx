"use client";

/**
 * /lab/cloud-canvas — sandbox for the image-globe showcase. Mounts the reusable
 * CloudCanvasView (client-only) over the site's global sky and drives it with a
 * live control panel. Tune a look here, hit "copy config", and paste the JSON into
 * cloud-canvas-config.ts as a named preset for the portfolio `cloudCanvas` variant.
 *
 * Dev-only: app/lab/layout.tsx 404s the whole /lab segment in production builds.
 * The canvas is loaded via next/dynamic({ ssr:false }) — it can't render on the
 * server (Canvas 2D + image decode are browser-only), mirroring /lab/clouds.
 */
import { useState } from "react";
import dynamic from "next/dynamic";
import CloudCanvasControls from "./controls";
import {
  DEFAULT_CLOUD_CANVAS_CONFIG,
  type CloudCanvasConfig,
} from "@/components/sections/portfolio/cloud-canvas/cloud-canvas-config";
import {
  cloudProjects,
  type CloudFilter,
} from "@/components/sections/portfolio/cloud-canvas/cloud-canvas-data";

const CloudCanvasView = dynamic(
  () => import("@/components/sections/portfolio/cloud-canvas/cloud-canvas-view"),
  { ssr: false },
);

export default function CloudCanvasLabPage() {
  const [config, setConfig] = useState<CloudCanvasConfig>(DEFAULT_CLOUD_CANVAS_CONFIG);
  const [filter, setFilter] = useState<CloudFilter>("all");

  return (
    <main className="fixed inset-0 h-dvh w-dvw overflow-hidden">
      {/* Clean sky backdrop for the sandbox — covers the global drei CloudLayer so
          the globe reads clearly while tuning. The real portfolio variant stays
          transparent over the actual sky + clouds; this fill is lab-only. */}
      <div className="absolute inset-0 z-0 bg-[#62abff]" />
      <CloudCanvasView
        config={config}
        filter={filter}
        className="absolute inset-0 z-[1] h-full w-full"
      />
      <CloudCanvasControls
        config={config}
        onChange={setConfig}
        imageCount={cloudProjects.length}
        filter={filter}
        onFilterChange={setFilter}
      />
    </main>
  );
}

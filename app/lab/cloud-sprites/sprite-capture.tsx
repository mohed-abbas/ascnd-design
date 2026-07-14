"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Cloud, Clouds } from "@react-three/drei";
import { useCallback, useEffect, useState } from "react";
import * as THREE from "three";

/**
 * LAB ONLY — /lab/cloud-sprites
 *
 * Bakes each unique cloud recipe (seed/bounds/volume combo from
 * components/background/cloud-specs.ts) into a transparent, alpha-cropped WebP
 * sprite. These sprites back the mobile/no-WebGL static cloud layer, so the
 * render setup deliberately MIRRORS the production canvas (cloud-canvas.tsx):
 * same camera, same DAY light pair (theme tinting happens later via CSS filter
 * on the <img>), same material/texture, ACES default tone mapping, segments 20
 * (the high-tier look — a bake should be the best version).
 *
 * Flow: recipes render one at a time into a transparent canvas
 * (preserveDrawingBuffer for the readback); after a settle burst of frames the
 * buffer is read back, cropped to its alpha bounding box, encoded as WebP and
 * queued; then the next recipe mounts. "Save all" POSTs every sprite to the
 * dev-only /api/lab/sprites writer, which lands them in public/clouds/sprites/.
 *
 * Lab tool — the private rAF here is fine (matches /lab/clouds); nothing from
 * this route ships on the page.
 */

type Recipe = {
  /** Output filename under public/clouds/sprites/. */
  file: string;
  seed: number;
  bounds: [number, number, number];
  volume: number;
  /** Which cloud-specs.ts entries use this recipe (documentation only). */
  usedBy: string;
};

// Every unique seed/bounds/volume combo across SKY_CLOUDS + ROCK_CLOUDS.
const RECIPES: Recipe[] = [
  { file: "hero-puff.webp", seed: 4, bounds: [4, 1.2, 1], volume: 4, usedBy: "top-right · bottom-left · finalcta-tl" },
  { file: "cards-bank.webp", seed: 11, bounds: [7, 1.4, 1], volume: 6, usedBy: "cards-br" },
  { file: "whystay-left.webp", seed: 11, bounds: [6, 2.4, 1], volume: 8, usedBy: "whystay-bl" },
  { file: "whystay-wide.webp", seed: 11, bounds: [8, 4, 1], volume: 10, usedBy: "whystay-br" },
  { file: "whystay-small.webp", seed: 11, bounds: [4, 1.5, 1], volume: 8, usedBy: "whystay-bl-2" },
  { file: "wide-bank.webp", seed: 11, bounds: [7, 1.4, 1], volume: 4, usedBy: "workingwith-left · testimonials-left-bottom" },
  { file: "puff-small.webp", seed: 11, bounds: [4, 1, 1], volume: 3, usedBy: "workingwith-right-bottom" },
  { file: "puff-soft.webp", seed: 11, bounds: [4, 1.4, 1], volume: 4, usedBy: "testimonials-right-top" },
  { file: "cta-bank.webp", seed: 11, bounds: [5, 1.3, 1], volume: 5, usedBy: "finalcta-br" },
  { file: "footer-bank.webp", seed: 11, bounds: [5, 1.6, 1], volume: 6, usedBy: "footer-bl-behind" },
  { file: "rock-skirt-left.webp", seed: 7, bounds: [6.5, 0.45, 1], volume: 8, usedBy: "rock-left" },
  { file: "rock-skirt-right.webp", seed: 3, bounds: [6.5, 0.45, 1], volume: 8, usedBy: "rock-right" },
  { file: "footer-wisp.webp", seed: 7, bounds: [3.5, 0.4, 1], volume: 4, usedBy: "footer-br-front" },
];

// Production look constants (cloud-canvas.tsx CLOUD/CAMERA/day palette), except
// speed 0: the bake must be deterministic, not mid-morph.
const CLOUD = { opacity: 0.8, fade: 10, growth: 4, speed: 0, color: "white" } as const;
const SEGMENTS = 20;
const CAMERA = { position: [0, 11, 18] as [number, number, number], fov: 50 };
const KEY_LIGHT_POSITION = [0, 20, 12] as [number, number, number];
const DAY = {
  ambient: { color: "#ffffff", intensity: 1.5 },
  key: { color: "#ffffff", intensity: 2.6 },
};

// Frames to let drei build geometry + decode the texture before reading back.
const SETTLE_FRAMES = 40;
// Transparent padding kept around the alpha bounding box.
const PAD = 12;

type Captured = {
  file: string;
  dataUrl: string;
  width: number;
  height: number;
  /** True if the cloud touched the canvas edge — the sprite is cut off. */
  clipped: boolean;
};

/** Crop a WebGL canvas to its alpha bounding box; encode as WebP. */
function cropAlpha(src: HTMLCanvasElement): Omit<Captured, "file"> | null {
  const w = src.width;
  const h = src.height;
  const full = document.createElement("canvas");
  full.width = w;
  full.height = h;
  const ctx = full.getContext("2d")!;
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 4) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null; // nothing rendered yet
  const clipped = x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1;
  x0 = Math.max(0, x0 - PAD);
  y0 = Math.max(0, y0 - PAD);
  x1 = Math.min(w - 1, x1 + PAD);
  y1 = Math.min(h - 1, y1 + PAD);
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  out.getContext("2d")!.drawImage(full, x0, y0, cw, ch, 0, 0, cw, ch);
  return { dataUrl: out.toDataURL("image/webp", 0.9), width: cw, height: ch, clipped };
}

/** Waits for the current recipe to settle, reads the buffer back, reports up. */
function CaptureRig({
  recipe,
  onCaptured,
}: {
  recipe: Recipe;
  onCaptured: (c: Captured) => void;
}) {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    let raf = 0;
    let frames = 0;
    const tick = () => {
      if (++frames < SETTLE_FRAMES) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const crop = cropAlpha(gl.domElement);
      if (!crop) {
        // Texture not decoded yet — keep waiting.
        raf = requestAnimationFrame(tick);
        return;
      }
      onCaptured({ file: recipe.file, ...crop });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [recipe, gl, onCaptured]);

  return null;
}

export default function SpriteCapture() {
  const [index, setIndex] = useState(0);
  const [captures, setCaptures] = useState<Captured[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const recipe = index < RECIPES.length ? RECIPES[index] : null;

  const onCaptured = useCallback((c: Captured) => {
    setCaptures((prev) => [...prev, c]);
    setIndex((i) => i + 1);
  }, []);

  const saveAll = useCallback(async () => {
    setSaveState("saving");
    try {
      for (const c of captures) {
        const res = await fetch("/api/lab/sprites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: c.file, dataUrl: c.dataUrl }),
        });
        if (!res.ok) throw new Error(`${c.file}: ${res.status} ${await res.text()}`);
      }
      setSaveState("done");
      setSaveMsg(`${captures.length} sprites → public/clouds/sprites/`);
    } catch (e) {
      setSaveState("error");
      setSaveMsg(String(e));
    }
  }, [captures]);

  return (
    <main className="fixed inset-0 flex h-dvh w-dvw bg-neutral-900 text-white">
      {/* Live capture stage — checkerboard so the alpha is visually obvious. */}
      <div
        className="relative h-full flex-1"
        style={{
          backgroundImage:
            "repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%)",
          backgroundSize: "32px 32px",
        }}
      >
        {recipe && (
          <Canvas
            key={recipe.file}
            dpr={2}
            gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
            camera={{ position: CAMERA.position, fov: CAMERA.fov }}
            onCreated={({ camera }) => {
              camera.lookAt(0, 0, 0);
              camera.updateProjectionMatrix();
              camera.updateMatrixWorld();
            }}
            style={{ position: "absolute", inset: 0 }}
          >
            <ambientLight color={DAY.ambient.color} intensity={DAY.ambient.intensity} />
            <directionalLight
              color={DAY.key.color}
              intensity={DAY.key.intensity}
              position={KEY_LIGHT_POSITION}
            />
            <Clouds
              material={THREE.MeshLambertMaterial}
              texture="/textures/cloud-puff.png"
              limit={400}
              range={400}
              frustumCulled={false}
            >
              <Cloud
                {...CLOUD}
                segments={SEGMENTS}
                seed={recipe.seed}
                bounds={recipe.bounds}
                volume={recipe.volume}
              />
            </Clouds>
            <CaptureRig recipe={recipe} onCaptured={onCaptured} />
          </Canvas>
        )}
        <div className="absolute left-4 top-4 rounded bg-black/60 px-3 py-2 font-mono text-sm">
          {recipe
            ? `capturing ${index + 1}/${RECIPES.length} — ${recipe.file} (${recipe.usedBy})`
            : `done — ${captures.length}/${RECIPES.length} captured`}
        </div>
      </div>

      {/* Results rail */}
      <aside className="h-full w-[380px] shrink-0 overflow-y-auto border-l border-white/10 bg-neutral-950 p-4">
        <h1 className="mb-1 font-mono text-sm font-bold">cloud sprite bake</h1>
        <p className="mb-4 font-mono text-xs text-white/50">
          {captures.length}/{RECIPES.length} captured
        </p>
        <button
          onClick={saveAll}
          disabled={captures.length < RECIPES.length || saveState === "saving"}
          className="mb-2 w-full rounded bg-white px-3 py-2 font-mono text-sm font-bold text-black disabled:opacity-30"
          data-save-all
        >
          {saveState === "saving" ? "saving…" : "Save all to public/clouds/sprites"}
        </button>
        {saveMsg && (
          <p
            className={`mb-4 font-mono text-xs ${saveState === "error" ? "text-red-400" : "text-green-400"}`}
            data-save-result={saveState}
          >
            {saveMsg}
          </p>
        )}
        <ul className="space-y-3">
          {captures.map((c) => (
            <li key={c.file} className="rounded border border-white/10 p-2">
              <div
                className="mb-1"
                style={{
                  backgroundImage:
                    "repeating-conic-gradient(#556 0% 25%, #334 0% 50%)",
                  backgroundSize: "16px 16px",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- lab preview of an in-memory dataURL */}
                <img src={c.dataUrl} alt={c.file} className="w-full" />
              </div>
              <p className="font-mono text-xs">
                {c.file} · {c.width}×{c.height}
                {c.clipped && <span className="ml-1 font-bold text-red-400">CLIPPED</span>}
              </p>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}

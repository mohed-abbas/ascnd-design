import * as THREE from "three";
import { PALETTES, type ThemeMode } from "./palette";

/**
 * Sky-gradient backdrop for the liquid-glass wordmarks (intro + footer).
 *
 * MeshTransmissionMaterial's `background` fills the refraction where its scene is
 * empty (open sky). A flat colour there reads wrong the moment the DOM sky is a
 * gradient — especially the two-tone sunrise/sunset modes — so this builds a tiny
 * vertical-gradient CanvasTexture from the REAL sky stops, mirroring
 * background.tsx's SKY_GRADIENT (top 0% → mid 55% → bottom 100%). drei assigns
 * `background` to scene.background during its FBO pass, so a texture works
 * exactly like the old colour did.
 *
 * The returned object is STABLE and mutated in place: on a theme change, lerp the
 * `stops` and call `redraw()` (re-uploads the 2×256 canvas — trivial), then
 * request a repaint however the owning canvas paints (requestPaint/invalidate).
 * Dispose the texture on unmount.
 */

/** Mid-stop position — keep in sync with background.tsx's SKY_GRADIENT. */
export const SKY_MID_STOP = 0.55;

export type SkyBackdrop = {
  texture: THREE.CanvasTexture;
  stops: { top: THREE.Color; mid: THREE.Color; bottom: THREE.Color };
  redraw: () => void;
};

export function makeSkyBackdrop(mode: ThemeMode): SkyBackdrop {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const p = PALETTES[mode];
  const stops = {
    top: new THREE.Color(p.sky.top),
    mid: new THREE.Color(p.sky.mid),
    bottom: new THREE.Color(p.sky.bottom),
  };
  const redraw = () => {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, `#${stops.top.getHexString()}`);
    g.addColorStop(SKY_MID_STOP, `#${stops.mid.getHexString()}`);
    g.addColorStop(1, `#${stops.bottom.getHexString()}`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    texture.needsUpdate = true;
  };
  redraw();
  return { texture, stops, redraw };
}

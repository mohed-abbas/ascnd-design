import type { RockRelight } from "./palette";

/**
 * The 2.5D relight lighting model (rock treatment "relight"), shared by every
 * surface that draws the painted cliffs so they can't drift apart:
 *  - components/ui/relit-rock.tsx — the hero cliffs (raw WebGL2 quad);
 *  - components/sections/intro/intro-scene.tsx — the intro's WebGL rock planes,
 *    which hand off to those cliffs at the end of the loader.
 *
 * Inputs per pixel: the painting's LINEAR albedo, and the `<name>.relight.webp`
 * texel (raw data: R,G = tangent-space normal x,y; B = the painting's baked
 * low-frequency shading, 0.5 = average). See relit-rock.tsx for the map's
 * derivation (scripts/rocks/gen-relight-maps.py).
 *
 *   flat = albedo / mix(1, baked, flatten)
 *   out  = flat · (ambient + key·max(N·L, 0)) + flat · rim · rimTerm
 *
 * Day (ambient 1 / key 0 / rim 0 / flatten 0) returns the albedo unchanged.
 * Output is LINEAR; the caller encodes to sRGB.
 */
export const RELIGHT_GLSL = /* glsl */ `
uniform vec3 uAmbient;
uniform vec3 uKey;
uniform vec3 uKeyDir;
uniform vec3 uRim;
uniform float uFlatten;

vec3 relightRock(vec3 alb, vec3 relief) {
  // Soften the derived relief: at full strength the painting's strokes read
  // as an embossed, plastic surface. Scale x,y and renormalise.
  vec3 n = normalize(vec3((relief.xy * 2.0 - 1.0) * 0.45, 1.0));
  float baked = relief.z * 2.0;
  vec3 flat_ = alb / clamp(mix(1.0, baked, uFlatten), 0.4, 2.5);

  vec3 L = normalize(uKeyDir);
  float ndl = max(dot(n, L), 0.0);
  vec2 lxy = normalize(L.xy + 1e-5);
  float edge = pow(clamp(1.0 - n.z, 0.0, 1.0), 1.5);
  float rim = edge * clamp(dot(normalize(n.xy + 1e-5), lxy), 0.0, 1.0) * 1.5;

  return flat_ * (uAmbient + uKey * ndl) + flat_ * uRim * rim;
}
`;

export type RelightParams = {
  ambient: number[];
  key: number[];
  keyDir: number[];
  rim: number[];
  flatten: number;
};

/** A mode's relight values, with the key's x MIRRORED per side (`mirror` = 1
 *  for the left cliff, -1 for the right) so one light above the middle of the
 *  page catches both cliffs' inner faces. */
export function relightParams(r: RockRelight, mirror: number): RelightParams {
  return {
    ambient: [...r.ambient],
    key: [...r.key],
    keyDir: [r.keyDir[0] * mirror, r.keyDir[1], r.keyDir[2]],
    rim: [...r.rim],
    flatten: r.flatten,
  };
}

export function lerpRelight(a: RelightParams, b: RelightParams, t: number): RelightParams {
  const l = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] - v) * t);
  return {
    ambient: l(a.ambient, b.ambient),
    key: l(a.key, b.key),
    keyDir: l(a.keyDir, b.keyDir),
    rim: l(a.rim, b.rim),
    flatten: a.flatten + (b.flatten - a.flatten) * t,
  };
}

/** The relight map that sits next to a painted cliff (`x.avif` → `x.relight.webp`). */
export function relightMapFor(src: string): string {
  return src.replace(/\.[a-z0-9]+$/i, ".relight.webp");
}

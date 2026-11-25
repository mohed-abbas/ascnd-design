"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CROSSFADE, PALETTES } from "@/lib/theme/palette";
import {
  RELIGHT_GLSL,
  lerpRelight,
  relightParams,
  type RelightParams,
} from "@/lib/theme/relight-shader";
import { useMode } from "@/lib/theme/use-mode";

/**
 * 2.5D RELIGHT (rock treatment "relight") — draws a painted
 * cut-out rock in a small WebGL quad and relights it per sky mode, instead of
 * recolouring it with a CSS filter or tint.
 *
 * Inputs per rock:
 *  - the painting itself (`src`, straight alpha) — the albedo;
 *  - a relight map (`map`, `<name>.relight.webp`, quarter-res, opaque RGB):
 *      R,G = tangent-space normal x,y (z rebuilt here), derived offline from
 *            the painting — an inflated silhouette (so the outline rounds off
 *            and catches a rim) plus band-passed luminance (strokes → relief);
 *      B   = the painting's own low-frequency shading (its baked daylight),
 *            0.5 = average, so the shader can divide some of it back out.
 *    Generator: scripts/rocks/gen-relight-maps.py.
 *
 * Lighting (linear light, per mode from PALETTES[mode].rock.relight):
 *   flat = albedo / mix(1, baked, flatten)
 *   out  = flat · (ambient + key·max(N·L, 0)) + flat · rim · rimTerm
 * Day is ambient 1 / key 0 / rim 0 / flatten 0, which returns the painting
 * unchanged — so day mode is pixel-identical to the plain <img>.
 *
 * The key direction's x is MIRRORED per side (`side`), so one "moon/sun above
 * the middle of the page" lights both cliffs' inner faces.
 *
 * Paint policy: draws only when something changes — once when textures land,
 * on resize, and on each frame of a mode crossfade (a gsap tween, so the
 * repaint rides the shared GSAP ticker; no private rAF). Idle = zero GPU work.
 * dpr capped at 1.5 (site rule).
 *
 * The canvas sits on top of the caller's <img> inside the RockArt group (so the
 * base-fade mask applies to it). Once the first frame is drawn it stamps
 * `data-relit-ready` on that group: the canvas fades in over the <img> (which
 * carries B's tint as the stand-in until then), and the <img> hides once
 * the fade is done, so its soft edges can't fringe through the canvas
 * (globals.css). The <img> stays in the DOM: it's the hero's LCP element and
 * the fallback.
 *
 * COST (production): RockArt mounts this only where it changes pixels — a
 * non-day mode on a desktop-width screen (day is the identity) — so day and
 * mobile visitors pay nothing. When it does mount, both images are decoded OFF
 * the main thread (fetch → createImageBitmap; the painting is already in the
 * HTTP cache from the <img>), and the painting is decoded straight to display
 * size: the 3928px-tall source is ~2.7× what a 1.5-dpr canvas can show, so
 * uploading it full-size cost ~30 MB of GPU memory per cliff and a long
 * synchronous decode + upload during the intro.
 */

const DPR_CAP = 1.5;

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// The lighting model itself lives in lib/theme/relight-shader.ts, shared with
// the intro's WebGL rock planes so the loader → hero hand-off matches.
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uAlbedo;
uniform sampler2D uRelief;
${RELIGHT_GLSL}

vec3 toLin(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  // The painting arrives PREMULTIPLIED (see decode()); divide it back out.
  vec4 a = texture(uAlbedo, vUv);
  if (a.a <= 0.0) { fragColor = vec4(0.0); return; }
  vec3 col = relightRock(toLin(a.rgb / a.a), texture(uRelief, vUv).rgb);
  fragColor = vec4(toSrgb(col) * a.a, a.a);
}`;

type Params = RelightParams;

/**
 * Decode an image off the main thread with no colour-space conversion (the
 * shader decodes the painting's sRGB itself, and the relight map is data, not
 * colour). ImageBitmap uploads ignore the UNPACK_* flags, so these options are
 * what set the texels.
 *
 * PREMULTIPLIED on purpose: Firefox returns garbage alpha when
 * `premultiplyAlpha: "none"` is combined with a resize (the colour-keyed sky
 * comes back opaque), while "premultiply" is every browser's native path. The
 * shader divides alpha back out. Premultiplied also mips cleanly — straight-
 * alpha mips bleed the transparent pixels' key colour into the soft edges.
 * (The relight map is opaque, so premultiplying leaves it unchanged.)
 * `height` (optional) decodes straight to that size, keeping the aspect ratio.
 */
async function decode(src: string, height?: number): Promise<ImageBitmap> {
  const blob = await (await fetch(src)).blob();
  const opts: ImageBitmapOptions = {
    premultiplyAlpha: "premultiply",
    colorSpaceConversion: "none",
  };
  if (height) {
    opts.resizeHeight = height;
    opts.resizeQuality = "high";
  }
  return createImageBitmap(blob, opts);
}

/**
 * How tall to decode the painting: the tallest this canvas can get on this
 * screen (the cliff spans the hero's height) at the capped dpr, never more than
 * the source. Sized to the screen rather than the current window, so resizing
 * the window never needs a re-decode.
 */
function albedoHeight(canvas: HTMLCanvasElement): number | undefined {
  const img = canvas.parentElement?.querySelector("img");
  const natural = img?.naturalHeight ?? 0;
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  const tallest = Math.max(window.screen?.height ?? 0, canvas.clientHeight);
  const want = Math.ceil(tallest * dpr);
  // Unknown source size (the <img> hasn't loaded) or no saving → decode as-is.
  return natural > 0 && want < natural ? want : undefined;
}

function loadSources(canvas: HTMLCanvasElement, src: string, map: string) {
  return Promise.all([decode(src, albedoHeight(canvas)), decode(map)]);
}

type GLState = {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
  textures: WebGLTexture[];
};

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? "shader compile failed");
  }
  return sh;
}

function initGL(
  canvas: HTMLCanvasElement,
  albedo: ImageBitmap,
  relief: ImageBitmap,
): GLState | null {
  const gl = canvas.getContext("webgl2", {
    premultipliedAlpha: true,
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) return null;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) ?? "program link failed");
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  // Raw, premultiplied, top-down texels: set by decode()'s ImageBitmap
  // options (WebGL ignores the UNPACK_* flags for ImageBitmap sources).

  const textures = [albedo, relief].map((img, unit) => {
    const t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  });

  const u: GLState["u"] = {};
  for (const name of ["uAlbedo", "uRelief", "uAmbient", "uKey", "uKeyDir", "uRim", "uFlatten"]) {
    u[name] = gl.getUniformLocation(prog, name);
  }
  gl.uniform1i(u.uAlbedo, 0);
  gl.uniform1i(u.uRelief, 1);
  return { gl, prog, u, textures };
}

export default function RelitRock({
  src,
  map,
  side,
}: {
  /** The painting (same file as the <img> beneath). */
  src: string;
  /** Its relight map (`<name>.relight.webp`). */
  map: string;
  /** Which cliff — mirrors the key light so both inner faces catch it. */
  side: "left" | "right";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mode = useMode();
  const mirror = side === "left" ? 1 : -1;

  // Live lighting state + the draw fn, shared between the GL and mode effects.
  const live = useRef<{ params: Params; draw: (() => void) | null }>({
    params: relightParams(PALETTES[mode].rock.relight, mirror),
    draw: null,
  });

  // GL lifecycle: load both images, build the program, draw on resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let state: GLState | null = null;
    let cancelled = false;
    const group = canvas.parentElement;
    const shared = live.current;

    const draw = () => {
      if (!state) return;
      const { gl, u } = state;
      const p = shared.params;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform3fv(u.uAmbient, p.ambient);
      gl.uniform3fv(u.uKey, p.key);
      gl.uniform3fv(u.uKeyDir, p.keyDir);
      gl.uniform3fv(u.uRim, p.rim);
      gl.uniform1f(u.uFlatten, p.flatten);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      draw();
    };
    const ro = new ResizeObserver(resize);

    // Bitmaps are only needed until they're uploaded — close them right after.
    const build = ([albedo, relief]: ImageBitmap[]) => {
      try {
        return cancelled ? null : initGL(canvas, albedo, relief);
      } finally {
        albedo.close();
        relief.close();
      }
    };

    loadSources(canvas, src, map)
      .then((bitmaps) => {
        state = build(bitmaps);
        if (!state) return; // no WebGL2 → the <img> beneath stays visible
        shared.draw = draw;
        ro.observe(canvas);
        resize();
        group?.setAttribute("data-relit-ready", "");
      })
      .catch((err) => {
        console.warn("[relit-rock]", err);
      });

    // Context restore: rebuild from scratch (textures/programs are gone).
    const onLost = (e: Event) => e.preventDefault();
    const onRestored = () => {
      group?.removeAttribute("data-relit-ready");
      loadSources(canvas, src, map).then((bitmaps) => {
        state = build(bitmaps);
        if (state) {
          resize();
          group?.setAttribute("data-relit-ready", "");
        }
      });
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    return () => {
      cancelled = true;
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      shared.draw = null;
      group?.removeAttribute("data-relit-ready");
      if (state) {
        const { gl, prog, textures } = state;
        // Free GPU resources but DON'T force-lose the context: on a Fast
        // Refresh / effect re-run the same <canvas> is reused, and a lost
        // context can't be re-acquired from it.
        textures.forEach((t) => gl.deleteTexture(t));
        gl.deleteProgram(prog);
      }
    };
  }, [src, map]);

  // Mode crossfade: tween 0→1 between the current and target light sets on
  // the GSAP ticker, repainting each step.
  useEffect(() => {
    const from = live.current.params;
    const to = relightParams(PALETTES[mode].rock.relight, mirror);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const proxy = { t: 0 };
    const tween = gsap.to(proxy, {
      t: 1,
      duration: reduce ? 0 : CROSSFADE.duration,
      ease: CROSSFADE.ease,
      onUpdate: () => {
        live.current.params = lerpRelight(from, to, proxy.t);
        live.current.draw?.();
      },
    });
    return () => {
      tween.kill();
    };
  }, [mode, mirror]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="relit-rock pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

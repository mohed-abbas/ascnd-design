"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CROSSFADE, PALETTES, type RockRelight } from "@/lib/theme/palette";
import { useMode } from "@/lib/theme/use-mode";

/**
 * 2.5D RELIGHT (rock treatment "relight", dev prototype) — draws a painted
 * cut-out rock in a small WebGL quad and relights it per sky mode, instead of
 * recolouring it with a CSS filter or tint.
 *
 * Inputs per rock:
 *  - the painting itself (`src`, straight alpha) — the albedo;
 *  - a relight map (`map`, `<name>.relight.webp`, half-res, opaque RGB):
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
 * `data-relit-ready` on that group, which hides the <img> beneath (globals.css)
 * — otherwise the day-lit image would fringe through the canvas's soft edges.
 * The <img> stays in the DOM: it's the hero's LCP element and the fallback.
 */

const DPR_CAP = 1.5;

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uAlbedo;
uniform sampler2D uRelief;
uniform vec3 uAmbient;
uniform vec3 uKey;
uniform vec3 uKeyDir;
uniform vec3 uRim;
uniform float uFlatten;
const float NORMAL_SCALE = 0.45;

vec3 toLin(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec4 a = texture(uAlbedo, vUv);
  if (a.a <= 0.0) { fragColor = vec4(0.0); return; }
  vec3 r = texture(uRelief, vUv).rgb;
  // Soften the derived relief: at full strength the painting's strokes read
  // as an embossed, plastic surface. Scale x,y and renormalise.
  vec3 n = normalize(vec3((r.xy * 2.0 - 1.0) * NORMAL_SCALE, 1.0));
  float baked = r.z * 2.0;

  vec3 alb = toLin(a.rgb);
  vec3 flat_ = alb / clamp(mix(1.0, baked, uFlatten), 0.4, 2.5);

  vec3 L = normalize(uKeyDir);
  float ndl = max(dot(n, L), 0.0);
  vec2 lxy = normalize(L.xy + 1e-5);
  float edge = pow(clamp(1.0 - n.z, 0.0, 1.0), 1.5);
  float rim = edge * clamp(dot(normalize(n.xy + 1e-5), lxy), 0.0, 1.0) * 1.5;

  vec3 col = flat_ * (uAmbient + uKey * ndl) + flat_ * uRim * rim;
  fragColor = vec4(toSrgb(col) * a.a, a.a);
}`;

type Params = {
  ambient: number[];
  key: number[];
  keyDir: number[];
  rim: number[];
  flatten: number;
};

function paramsFor(r: RockRelight, mirror: number): Params {
  return {
    ambient: [...r.ambient],
    key: [...r.key],
    keyDir: [r.keyDir[0] * mirror, r.keyDir[1], r.keyDir[2]],
    rim: [...r.rim],
    flatten: r.flatten,
  };
}

function lerpParams(a: Params, b: Params, t: number): Params {
  const l = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] - v) * t);
  return {
    ambient: l(a.ambient, b.ambient),
    key: l(a.key, b.key),
    keyDir: l(a.keyDir, b.keyDir),
    rim: l(a.rim, b.rim),
    flatten: a.flatten + (b.flatten - a.flatten) * t,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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
  albedo: HTMLImageElement,
  relief: HTMLImageElement,
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

  // Raw texels: no colour-space conversion (the relief map is DATA, and we
  // decode the painting's sRGB ourselves), no premultiply (straight alpha in).
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

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
    params: paramsFor(PALETTES[mode].rock.relight, mirror),
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

    Promise.all([loadImage(src), loadImage(map)])
      .then(([albedo, relief]) => {
        if (cancelled) return;
        state = initGL(canvas, albedo, relief);
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
      Promise.all([loadImage(src), loadImage(map)]).then(([a, r]) => {
        if (cancelled) return;
        state = initGL(canvas, a, r);
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
    const to = paramsFor(PALETTES[mode].rock.relight, mirror);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const proxy = { t: 0 };
    const tween = gsap.to(proxy, {
      t: 1,
      duration: reduce ? 0 : CROSSFADE.duration,
      ease: CROSSFADE.ease,
      onUpdate: () => {
        live.current.params = lerpParams(from, to, proxy.t);
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

/**
 * Coarse GPU-strength heuristic (docs/performance-audit.md §6 C2).
 *
 * There is no reliable "how fast is this GPU" web API, so we sniff the unmasked
 * renderer string plus device memory / core count and bucket into strong / weak
 * / unknown. This only picks the STARTING tier — the runtime frame-time watchdog
 * (frame-watchdog.ts) is the real safety net, so a wrong guess self-corrects.
 * Deliberately conservative: `unknown` is treated as capable (starts high) and
 * lets the watchdog catch trouble, rather than degrading a machine that's fine.
 *
 * ── CALIBRATE ── the renderer regexes cover the common device families by
 * generation (extended 2026-07-02, audit F5/D2) but are still heuristic, not
 * profiled. When a real device misbehaves, add its renderer string to the
 * matching branch. Keep the fallback branches conservative: ambiguous strings
 * must fall through to `unknown` (starts high), never to `weak`.
 */

export type GpuStrength = "strong" | "weak" | "unknown";

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

export function detectGpuStrength(): GpuStrength {
  if (typeof document === "undefined") return "unknown";

  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ||
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return "weak"; // no WebGL at all → can't run the heavy path
    try {
      return classifyFromContext(gl);
    } finally {
      // Free the probe context immediately so it doesn't count against the
      // browser's WebGL context budget (same pattern as cloud-layer.tsx). On
      // Firefox this logs a benign "WebGL context was lost." line — that's the
      // intentional teardown, not an error.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    return "unknown";
  }
}

function classifyFromContext(gl: WebGLRenderingContext): GpuStrength {
  try {
    // Prefer the plain RENDERER parameter: on Firefox it returns the same
    // (coarsened) renderer string as the extension WITHOUT logging the
    // "WEBGL_debug_renderer_info is deprecated" console warning. On Chromium
    // plain RENDERER historically returns a generic placeholder ("WebKit
    // WebGL"), so when the value is generic/empty we fall back to the
    // WEBGL_debug_renderer_info extension path, which still works there.
    let renderer = String(gl.getParameter(gl.RENDERER) ?? "").trim();
    if (renderer === "" || /^(webkit webgl|mozilla)$/i.test(renderer)) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = dbg
        ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
        : "";
    }
    const r = renderer.toLowerCase();

    // Firefox anti-fingerprinting coarsens the renderer into a BUCKET, marked
    // by a trailing "or similar" — e.g. a modern Arc-class iGPU reports
    // "Intel(R) HD Graphics, or similar", which would false-match the weak
    // Intel branch below. A bucketed string says nothing about the actual
    // part, so skip renderer classification entirely and let the memory/cores
    // fallback decide (deviceMemory is Chromium-only → undefined on Firefox,
    // so cores carry it there). Per the calibration note: ambiguous must fall
    // through toward `unknown` (starts high; the watchdog demotes on real
    // jank), never to `weak`.
    if (!r.endsWith("or similar")) {
      const byRenderer = classifyRenderer(r);
      if (byRenderer !== "unknown") return byRenderer;
    }

    // No decisive renderer match → fall back to memory / core count.
    const nav = navigator as NavigatorWithMemory;
    const mem = nav.deviceMemory ?? 0;
    const cores = navigator.hardwareConcurrency ?? 0;
    if ((mem && mem <= 4) || (cores && cores <= 4)) return "weak";

    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Bucket a (lowercased, unmasked) renderer string. `unknown` means "no decisive
 * match" — the caller falls through to the memory/cores heuristic.
 */
function classifyRenderer(r: string): GpuStrength {
  // Software rasterizers → definitely weak.
  if (/swiftshader|llvmpipe|software|basic render|microsoft/.test(r)) {
    return "weak";
  }
  // Integrated Intel HD/UHD/Iris → fill-rate bound for the MTM path.
  if (/intel.*(hd|uhd|iris) graphics/.test(r)) return "weak";
  // Older mobile GPUs (budget phones/tablets in desktop mode, ARM
  // Chromebooks): Adreno 2xx–5xx, Mali Utgard/Midgard (4xx / T-xxx) and
  // low-end Bifrost (G31/G51/G52/G71/G72), any PowerVR.
  // (Real Adreno strings read "Adreno (TM) 640" — match through the "(TM)".)
  if (/adreno[^0-9]*[2-5]\d\d|mali-[t4]\d+|mali-g[357][12]\b|powervr/.test(r)) {
    return "weak";
  }
  // Aging discrete cards the old strong branch's bare vendor names used to
  // promote: entry-level GeForce GT/GTS, pre-900-series GTX, Radeon HD and
  // the R5/R7/R9 rebrand era. All predate ~2015 and struggle at dpr 1.5.
  if (/geforce (gt|gts) |gtx [1-7]\d\d\b|radeon (hd|r[579] )/.test(r)) {
    return "weak";
  }
  // Modern capable hardware → strong. Deliberately names generations
  // instead of bare vendors ("nvidia" alone matched a 2010 GT 730): Apple
  // Silicon, GeForce GTX 900+/10xx/16xx/RTX, Radeon RX/Pro, Intel Arc,
  // recent Adreno, flagship Mali/Immortalis.
  if (
    /apple m\d|geforce (rtx|gtx (9|1[06])\d\d)|quadro rtx|radeon (rx|pro)|intel(\(r\))? arc|adreno[^0-9]*[678]\d\d|mali-g7[6-9]\b|mali-g[6-9]\d\d|immortalis/.test(
      r,
    )
  ) {
    return "strong";
  }

  return "unknown";
}

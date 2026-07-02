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

    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : "";
    const r = renderer.toLowerCase();

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

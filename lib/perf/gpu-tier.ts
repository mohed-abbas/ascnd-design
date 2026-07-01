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
 * ── CALIBRATE ── the renderer regexes below are a first pass; extend them once
 * you've profiled real weak devices. Keep the fallback branches conservative.
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
    // Apple Silicon, discrete NVIDIA/AMD, recent mobile → strong.
    if (/apple m\d|nvidia|geforce|radeon (rx|pro)|adreno (6|7|8)\d\d/.test(r)) {
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

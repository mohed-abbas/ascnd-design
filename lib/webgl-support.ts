/**
 * The ONE WebGL support probe for the whole app. CloudLayer, TestimonialRocks,
 * and the footer glass each used to spin up their own probe context to answer
 * "does this device do WebGL?" — three transient contexts, and (because each is
 * correctly released via WEBGL_lose_context) three benign but scary-looking
 * "WebGL context was lost." lines in Firefox's console on load. One shared,
 * module-cached probe → one teardown line, two fewer transient contexts.
 *
 * Support is static per device: the probe runs once on first call, the boolean
 * is cached at module level, and every later call (from any importer) is a pure
 * cache read — no further contexts are ever created.
 *
 * SSR-safe (`document` guard → `false` on the server), but note every current
 * caller only reaches this from a `useSyncExternalStore` CLIENT snapshot — each
 * keeps its own explicit `() => false` server snapshot, so server behaviour is
 * decided at the call site, not here.
 */
let webglSupport: boolean | null = null;

export function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  if (typeof document === "undefined") return false; // SSR — don't cache; re-probe on the client.
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    webglSupport = !!gl;
    // Free the probe context immediately so it doesn't count against the
    // browser's WebGL context budget. This release is what Firefox logs
    // (benignly) as "WebGL context was lost." — exactly once, ever.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

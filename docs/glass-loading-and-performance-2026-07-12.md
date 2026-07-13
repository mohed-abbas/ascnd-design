# Glass wordmark — loading & performance report (2026-07-12)

Scope: the liquid-glass "ascnd" wordmark (drei `MeshTransmissionMaterial` +
`Text3D`), primarily the **footer** instance
(`components/sections/footer/footer-glass-scene.tsx`), with notes that apply to
the intro instance too. Written after the footer's slow-reveal investigation;
companion docs: `webgl-animation-audit-2026-07-02.md` (site-wide audit),
`cloud-rendering-research.md` (layered rendering model).

---

## 1. The problem, precisely

Arriving at the footer, the glass appeared late while everything else was
already there. The latency chain, in order:

1. **Deferred mount** — the canvas didn't exist until the footer was near
   (IntersectionObserver). A fast flick crossed the old margin in ~200ms, so
   every cost below started *after* arrival.
2. **JS chunk** — the scene is `next/dynamic`; its fetch began at mount.
3. **Textures/font** — the 652KB mountain cutout; the typeface JSON (usually
   already cached by the intro).
4. **WebGL context creation** — ~50–150ms.
5. **Shader compile + env build + glyph geometry** — the sneaky one. The
   transmission shader is enormous; compile/link is 100–500ms on some GPUs
   (worst on Windows/ANGLE). It happens **per context, per page load** and
   cannot start before the canvas exists.

Items 2–3 are network and cacheable. Item 5 is not (see §2) — it can only be
*scheduled earlier* and *covered*.

## 2. Can we cache compiled shaders (localStorage / cookies)? — No

The idea: persist the compiled shader after first load and reuse it later.

- **Cookies**: hard no regardless of anything else — ~4KB limit, and cookies
  are re-sent with every HTTP request; heavy data there slows the whole site.
- **localStorage / Cache API**: could only hold the GLSL *source* — which
  already ships inside the HTTP-cached JS chunk. Downloading source was never
  the cost.
- **The compile itself**: WebGL deliberately exposes **no API to extract or
  re-inject compiled programs**. Native GL has `glProgramBinary`; the web never
  got it (binaries are GPU+driver+browser specific; portability and security).
  JavaScript cannot persist a compiled shader. Full stop.
- **What exists instead**: browsers keep their own **GPU shader disk cache**
  keyed on exact GLSL source + driver — a *returning* visitor's compile is
  near-instant, automatically. First-visit compile is physically unavoidable;
  all we control is when it runs and what covers it.
- **Within one page load**: the intro and footer glasses compile the same
  material twice because they are **two WebGL contexts**. The browser's
  program cache usually makes the second compile cheap (identical source —
  note both read the same tier's `mtmSamples`, and `samples` is baked into the
  shader source, so keep them aligned). True compile-once-reuse-everywhere is
  the single-canvas architecture (§6, S6).

## 3. "Why don't other heavy WebGL sites have this problem?"

They do — they hide it, or they never pay it:

- **A loading screen compiles everything once up front.** We do exactly this
  for the intro. The footer was unusual: a *second, mid-page* context, created
  late **by design** to keep WebGL contention away from the intro's load
  window (see the slow-network intro hardening). That deferral is what moved
  the compile to arrival time — a scheduling side-effect, not a defect.
- **A single persistent canvas** (drei `View` pattern) reused across all
  sections/pages: one context, one compile, shared GPU resources.
- **Cheaper materials.** Most "glassy" showcase sites fake it: matcaps,
  env-map reflections, screen-space refraction against a static texture. MTM
  does real refraction — a full extra scene render into an FBO every painted
  frame plus `samples × 3` refraction taps per fragment on top of
  MeshPhysicalMaterial. It is one of the most expensive materials in the
  ecosystem, and we run it as a hero element twice per page.
- **They also run free 60fps loops forever.** Our constraints (idle-to-zero,
  one shared ticker, dpr cap) trade a harder loading choreography for a far
  better steady state.

## 4. Codrops audit

Against "Building Efficient Three.js Scenes" (Codrops, 2025-02-11):

| Article tip | Status | Evidence / note |
|---|---|---|
| Cap dpr (≤1.5) | ✅ | `dpr={[1, 1.5]}`; site-wide cap is a documented contract |
| Suspend rendering when hidden/idle | ✅ beyond | Article: pause on `visibilitychange`. Us: zero frames whenever nothing changes, even visible (request-driven `frameloop="never"`) |
| Texture baking for static content | ✅ | The poster/fallback IS a bake; mountains are a pre-lit photo on `meshBasicMaterial` |
| Environment/Lightformers over many lights | ✅ | `GlassEnvironment` + 1 directional + 1 ambient; no shadows |
| Perf monitoring + degradation callbacks | ✅ own system | `lib/perf/tiers.ts` tiers, `heavyEffectFpsCap()`, watchdog step-down (mounted features locked) |
| Instancing for repeated geometry | ✅ / N-A | Nothing repeated in the footer; clouds already use batched instanced `<Clouds>` |
| Low-poly geometry | ✅ | Text3D curve/bevel segments tier-driven (16–32 / 6–12), built once |
| Power-of-2 textures | ⚠️ | `footer-scene.webp` is 3168×1344 (NPOT). Correct in WebGL2, but ~17MB+ VRAM — see S1 |
| `antialias: false` | ⚠️ deliberate | MSAA kept: glass bevel edges over a transparent canvas need it |
| `alpha:false`, `stencil:false`, `depth:false` | ✅ | `alpha:true` required (DOM sky shows through); depth required (occluder trick); `stencil:false` now explicit (S3) — and verified already the default: three r163+ ships `stencil: false` and R3F doesn't override it |
| `powerPreference: "high-performance"` | ✅ already on | Correction (2026-07-13): R3F's `createRendererInstance` defaults include `powerPreference: 'high-performance'` (verified in the installed fiber source) — every canvas has requested the discrete GPU all along. S4 is therefore about opting *out* for battery, not in |
| GLB/Draco pipeline · post-processing · physics | N/A | None in the footer |
| Profiling (r3f-perf, Spector.js) | ✅ practice | `webgl-animation-audit-2026-07-02.md`; those are the tools for the next pass |

## 5. MTM-specific audit

| Lever | Guidance | Ours | Verdict |
|---|---|---|---|
| `resolution` (FBO) | Default 1024 wasteful; "with roughness, tiny resolutions still look good" | Intro 256–384, footer 128–192 by tier (S2, 2026-07-13) | ✅ |
| `samples` | Default 10; lower = faster | 4–8 by tier | ✅ |
| `backside` | Costliest single toggle (2nd scene render) | `false` | ✅ |
| Scene renders/frame | One FBO pass per MTM instance | 1 per canvas | ✅ (2 site-wide only because 2 contexts) |
| `temporalDistortion` | Nonzero ⇒ animates forever ⇒ permanent repaint | 0 (footer); 0.28 (intro, lives ~2s) | ✅ |
| Frame scheduling | Render on demand | Request-driven pump, idle = zero | ✅ beyond |

## 6. Solutions — status, impact, effort

### Shipped (2026-07-12)

| # | Solution | Impact |
|---|---|---|
| L1 | **Prefetch after the intro docks** (`warmFooterGlass`: scene chunk → module-scope `useTexture.preload` + `useFont.preload`, + poster image; triggers: `INTRO_REVEAL_EVENT`, 2s timer when no intro, first scroll fallback) | Removes ALL network latency from the arrival path on any normal visit |
| L2 | **Mount ~6 viewports early** (was ~3) | Context creation + shader compile + warm burst get a multi-second runway; with L1 the runway is spent only on the uncacheable work |
| L3 | **Poster swap** (baked composite as placeholder; canvas fires `onReady` after `READY_FRAMES` real frames; poster fades 300ms) | The footer *always* looks complete instantly — even End-key jumps and deep links. Converts any residual spin-up from a visible defect into an invisible crossfade. Verified: fresh load + instant bottom-jump shows poster at arrival, live canvas ~2s later (dev build; prod faster) |
| S2 | **Footer MTM `resolution` dropped to 128–192** (2026-07-13; new per-tier knob `mtmResolutionFooter` = 192/160/128 vs the intro's 384/320/256) | FBO fragments cut ~4× per painted frame; the heavy `roughness`/`anisotropicBlur` makes it visually indistinguishable (pending final eyeball). Safe to diverge from the intro: only `samples` is a shader-compile key, resolution is just buffer size | — |
| S3 | **`stencil: false` on the footer canvas** (2026-07-13) | Now explicit. Verification note: three r163+ already defaults `stencil: false` and R3F doesn't override it, so this pins existing behaviour rather than changing it | — |
| L4 | **Per-mode transparent posters** (2026-07-13): one baked still per theme mode (`footer-glass-fallback-{sunrise,day,sunset,night}.webp`, ~365KB each), read back from the live canvas WITH alpha (`toDataURL` under a temporary `preserveDrawingBuffer`), so the sky is transparent and the DOM gradient + clouds show through exactly like the live canvas. `PosterStack` (footer-scene.tsx) shows the current mode's still and crossfades on a theme switch in step with the sky's `CROSSFADE`; only visited modes are in the DOM (no eager 4× download). Kills the last visible artifact: a non-day visitor arriving fast used to see the day-baked poster under their themed sky. Verified live (night mode): poster phase and live phase are visually identical. The mobile/no-WebGL fallback now retints with the theme too | — |
| S1 | **Downsized + recompressed the mountain texture** (2026-07-13): `footer-scene.webp` 3168×1344 → **2046×868** — the SAME 33:14 ratio (`3168/1344` = `2046/868`), so the plane geometry (`MOUNTAIN_ASPECT`) is unchanged. `sharp` lanczos3 resize, WebP `quality 82` / `alphaQuality 96` (ridgeline silhouette drives the occluder interleave — kept crisp). VRAM **17.0MB → 7.1MB** (width×height×4, exactly the estimate); file **636KB → 219KB**. No DOM twin to sync — the asset is used only as the in-canvas mountain plane (`MOUNTAIN_SRC`). KTX2/BasisU skipped (optional; would need a loader). Verified: old-vs-new composite over the day sky is visually identical, and it's refracted/blurred through the glass in situ | — |

### Open — recommended next (cheap, incremental)

| # | Solution | Expected impact | Effort / risk |
|---|---|---|---|
| S4 | **Consider opting OUT of `powerPreference: "high-performance"`** (correction 2026-07-13: R3F defaults every canvas to high-performance already) | `"low-power"`/`"default"` would spare dual-GPU laptop batteries at the cost of slower compile/frames; today's behaviour = discrete GPU requested | Trivial / product decision, lean keep-as-is |

### Open — larger, only if justified later

| # | Solution | Expected impact | Effort / risk |
|---|---|---|---|
| S5 | **`transmissionSampler` mode** (three's built-in shared transmission buffer instead of drei's private FBO) | Could share one buffer if multiple transmission objects ever coexist in one scene; no benefit at 1 instance/scene today | Medium / visual differences documented by drei |
| S6 | **Single shared canvas (drei `View` pattern)** — one fixed full-viewport context; intro, clouds, testimonials, footer each render into scissored viewport rects | The real "compile once, reuse everywhere": 1 context, 1 MTM compile per load, shared textures/env; removes ALL mid-page context spin-ups permanently | High / high — re-architecture of every WebGL feature + the layering contract (`fixed` layers, z-stacking, blur-ancestor rule). Only worth it if WebGL sections keep multiplying |
| S7 | **Precompile intro+footer shader during the intro loader** (compile the footer's exact program in a hidden mesh inside the intro's context, relying on the browser's program cache to accelerate the footer's later compile) | Second-order: warms the *browser* shader cache on first visit so the footer context's compile hits it | Medium / fragile — depends on identical GLSL (incl. `samples`) and driver cache behaviour; measure before trusting |

## 7. Bottom line

- Already compliant with essentially every applicable published recommendation;
  several practices (idle-to-zero, tiered knobs, poster swap) go beyond them.
- The visible delay was a **scheduling** consequence of an unusually honest
  material plus deliberate intro protection — now hidden the same way polished
  sites hide theirs (prewarm + poster).
- Compiled-shader persistence from JS is impossible by web-platform design;
  browsers already give returning visitors that benefit via their own shader
  disk cache.
- S1 + S2 + S3 + L4 shipped 2026-07-13; the cheap incremental wins are done.
  Remaining open items (S4–S7) are either product decisions or larger
  re-architectures worth doing only if WebGL sections keep multiplying.

Sources: Codrops "Building Efficient Three.js Scenes" (2025-02-11) ·
drei MeshTransmissionMaterial docs · three.js forum threads on MTM/transmission
performance · MDN `KHR_parallel_shader_compile` · Mozilla bug 918941 (shader
compilation caching) — links in the report's chat version; all verified against
the installed drei source in `node_modules/@react-three/drei`.

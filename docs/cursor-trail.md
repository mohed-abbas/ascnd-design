# Cursor fluid-trail

A global cursor effect: the pointer leaves a glowing, smoke-like trail that
swirls and fades. Ported from `cursor-trail-main/` (a standalone Vite + raw
Three.js demo dropped into the repo) and adapted to this codebase's
conventions.

**Code:** `components/cursor/`
- `cursor-trail.tsx` — the device gate (mirrors `cloud-layer.tsx`).
- `cursor-trail-canvas.tsx` — the imperative Three.js port.
- `cursor-trail-shaders.ts` — the GLSL (inlined as strings).
- Mounted at the root in `app/layout.tsx`, after `<CloudLayer/>`.

## The technique

It is **not** a DOM-dots / SVG / canvas-2D trail. It is a **ping-pong
render-target feedback shader**:

1. A full-screen triangle renders into a **¼-resolution** `WebGLRenderTarget`.
2. Its fragment shader samples the **previous frame's** trail texture (`uMap`),
   advects the UVs along a **curl-noise** flow field (the smoke swirl at two
   scales), multiplies the result down each frame (the fade), and injects fresh
   colour blobs at the smoothed pointer position. Blob radius scales with
   cursor speed.
3. Two render targets are **swapped** each frame so the output feeds back as
   next frame's input — that feedback loop is what makes the trail persist and
   evolve.
4. A second pass draws the trail texture to screen.

The "feel" comes from two lerps in the per-frame update: a **position** lerp
(`dt*15`, the trailing lag) and a **speed** lerp (`dt*3`, how fast blob size
tracks velocity). The noise + colours are fully procedural — **no asset files**.

## Decisions

These were chosen for this site; each lists the alternatives that were
considered.

### Colours — **recolour to brand**
The source injects three hardcoded blobs: purple `vec3(0.25,0.1,0.9)`, teal
`vec3(0.1,0.9,0.8)`, white core `vec3(1.0)`. Retuned to an on-brand luminous
blue that reads as an additive extension of the `#62abff` sky:
- outer halo `vec3(0.25, 0.45, 1.0)` (saturated brand blue/indigo)
- mid ring `vec3(0.55, 0.85, 1.0)` (soft sky-cyan)
- hot core `vec3(1.0)` (white)

Edit these in `cursor-trail-shaders.ts` (search "BRAND PALETTE").

_Alternatives:_ **keep original** purple/teal/white (vivid, off-brand); **a
fully proposed palette** picked from scratch.

### Blend — **additive glow**
The canvas is transparent and the display pass emits `alpha = luminance(color)`
so idle (black) trail is fully transparent. The wrapper sets
`mix-blend-mode: screen`, so the trail composites as **light** that brightens
the sky/content rather than painting over it.

_Alternative:_ **solid trail** — normal alpha compositing, punchier and closer
to the source's opaque look but cut out as an overlay. To switch: drop
`mixBlendMode: "screen"` on the wrapper and keep the luminance alpha (or make
alpha a flat constant for fully opaque blobs).

### Placement — **above everything except the foreground cliffs**
The overlay sits at **`z-[90]`**: above the sky (`-z-20`), clouds (`-z-10` /
`z-[61]`), hero text (`z-10`), design shots, logos, and the far right cliff
(`z-0`); **below** the near left cliff (`z-[99]`), the grass-hover overlay
(`z-[100]`) and the navbar (`z-[999]`).

**The layering tradeoff.** The two cliffs don't share a z-band: the left cliff
is `z-[99]` (near foreground) but the right cliff is `z-0` — and the right
cliff sits *behind* the hero text (`z-10`). So no single overlay z can be
"above the text yet below **both** cliffs." The default keeps the prominent
left cliff + grass + navbar in front of the glow; the **far right cliff has the
glow pass in front of it**. If both cliffs should occlude the trail:
- raise the right rock above the trail in `components/sections/hero/rock.tsx`
  (change its `right-0 z-0` to e.g. `right-0 z-[91]`) — but note it then also
  covers the right side of the hero text, changing the composition; **or**
- drop the whole trail below the cliffs (set its z below `z-0`), which also
  pushes it behind the hero text.

_Alternatives:_ **above everything** (glow follows the cursor over text/UI too,
a true "magic cursor"); **behind content** (glow only in the sky, never touches
the hero text — calmest, best for legibility).

## Integration notes (codebase conventions)

- **One loop.** The per-frame update is added to **`gsap.ticker`**, never a
  private `requestAnimationFrame` — the repo mandate ("no competing
  schedulers", `lenis-provider.tsx`). The ticker passes `(time, deltaMs)`; we
  use `dt = deltaMs / 1000` in place of `THREE.Clock.getDelta()`. The trail
  decays every frame, so it runs continuously (not `frameloop:"demand"` like
  the clouds). GSAP parks the ticker on hidden tabs.
- **Device gating.** `next/dynamic({ ssr:false })` + `useSyncExternalStore`
  (mirrors `cloud-layer.tsx`). Skipped on: no WebGL, `prefers-reduced-motion`,
  `≤768px`, and coarse/no pointer (`(pointer: fine)` is required — a fluid
  cursor trail is meaningless on touch). Server snapshot is `false`, so SSR
  renders nothing and there's no hydration mismatch.
- **pointer-events.** `pointer-events-none` on the wrapper **and** set directly
  on the canvas element (R3F/Three set the canvas to `auto`, overriding a
  wrapper class — same gotcha the cloud canvas handles). The effect listens on
  `window` for `pointermove`, so the canvas is never the pointer target.
- **Fixed-layer rule.** Mounted at the root so no ancestor applies
  `filter`/`backdrop-filter` (which would break the fixed canvas). Don't put a
  `filter` on the wrapper.
- **WebGL budget.** Adds a third persistent context (two cloud canvases + this);
  fine on the gated desktop set. Full teardown on unmount disposes the render
  targets, materials, geometry and renderer, and removes the canvas (the source
  leaked all of these).
- **No `.glsl` import.** Turbopack has no `vite-plugin-glsl`, so the shaders are
  inlined as template-literal strings in `cursor-trail-shaders.ts`.
- **Dropped from the source:** `gsap`-as-animation (unused there), `tweakpane`,
  `OrbitControls`, and the `PerspectiveCamera` — the shaders write clip-space
  positions directly, so the camera is irrelevant (a bare `THREE.Camera()` is
  passed only because `renderer.render()` requires one).

## Tunable knobs

| Knob | Where | Default | Effect |
|---|---|---|---|
| Sim resolution scale | `cursor-trail-canvas.tsx` `RT_SCALE` | `0.25` | lower = blurrier/cheaper |
| Cursor lag | `cursor-trail-canvas.tsx` `prevPointer.lerp(pointer, dt*15)` | `15` | higher = snappier, lower = more lag |
| Speed smoothing | `cursor-trail-canvas.tsx` speed lerp `dt*3` | `3` | how fast blob size tracks velocity |
| Trail fade | `cursor-trail-shaders.ts` `color *= 1. - uDt*2.` | `2.` | higher = shorter trail |
| Blob size range | `cursor-trail-shaders.ts` `clamp(uSpeed*2., 0.075, 0.25)` | `0.075…0.25` | min/max radius vs speed |
| Curl swirl strength | `cursor-trail-shaders.ts` `*uDt*0.3` / `*0.15` | `0.3` / `0.15` | turbulence / smear amount |
| Curl freq / evolution | `cursor-trail-shaders.ts` `uv*4.`, `uv*2.`, `uTime*0.1` | — | flow-field scale & speed |
| Core / ring sharpness | `cursor-trail-shaders.ts` `pow(t2,10.)` / `pow(t3,4.)` | `10` / `4` | tightness of core / mid ring |
| Colours | `cursor-trail-shaders.ts` "BRAND PALETTE" | see above | the three trail colours |
| Pixel-ratio cap | `cursor-trail-canvas.tsx` `min(devicePixelRatio, 2)` | `2` | render sharpness vs cost |

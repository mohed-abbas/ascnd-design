# Cloud Colour & Lighting — why white clouds rendered grey, and how we fixed them

> Companion to `cloud-rendering-research.md` (the sky/clouds architecture ADR). That
> doc decides *what* technique renders the sky; this one decides how the clouds get
> their **colour and dimensional form**. Read alongside §9 of that doc.

## 1. The problem
The drei volumetric clouds rendered as a dull grey-blue mass instead of the Figma
reference's bright, dimensional white (cloud core ≈ `#fcfeff`, sky `#62abff`). "Make
the white brighter" was not enough — the grey had three independent causes.

## 2. Root causes (evidence-based)
Measured with Playwright pixel-sampling of the isolated cloud canvas, the drei source
(`node_modules/@react-three/drei/core/Cloud.js`), the texture, and a live read of the
WebGLRenderer.

1. **Texture is pure white** — `public/textures/cloud.png` opaque texels `(255,255,255)`
   with an alpha gradient. Not a cause.
2. **drei's Cloud fragment shader** ends with:
   `gl_FragColor = vec4(outgoingLight, diffuseColor.a * vOpacity)`.
   So a cloud's **RGB is the lit material colour** and its **alpha is coverage**
   (`textureAlpha × opacity × fade`). Colour and translucency are independent levers.
3. **ACES tone mapping (primary).** R3F defaults `gl.toneMapping` to ACES Filmic, which
   maps linear white `1.0` down to ~`0.8` and desaturates highlights — pure-white clouds
   came out ~`#c7c8ca`. The `<Canvas flat>` prop is meant to set `NoToneMapping` but did
   **not** reliably apply here (likely because it's a renderer-creation-time setting and
   was missed across HMR / in this R3F version). Reading the live renderer confirmed ACES
   was still active until we set it explicitly.
4. **Flat lighting kills dimensional form (secondary).** drei `<Cloud>` defaults to
   `MeshLambertMaterial` (a *lit* material). If you flood it with ambient and almost no
   directional, every cloud face renders the same value → a uniform soft blob with no
   bright-top/shadowed-bottom gradient. Even when technically white-cored, a formless
   cloud reads as a flat dull sheet. Real clouds (and the Figma photo) have sunlit tops
   and softly shadowed undersides — that gradient *is* the "bright cloud" look.

## 3. Technique landscape (why we stay on drei)
- **Billboard/sprite "puffy" clouds — what we use.** drei `<Clouds>`/`<Cloud>` is an
  `InstancedMesh` of camera-facing textured planes, alpha-blended to fake volume (it is
  *not* true raymarched volume despite the "volumetric" label). Cheap, fast, mobile-safe,
  precisely placeable, works with `frameloop="demand"`.
- **True raymarched volumetric clouds** (e.g. `three-volumetric-clouds`, shadertoy
  cloudscapes). Photoreal scattering, but per-pixel-expensive, complex, hard to art-direct,
  and would replace our stabilised resilient setup. Rejected for a sitewide/mobile bg.
- **Static cloud image cutouts.** Cheapest and pixel-exact, but flat/static.

Decision: **stay on drei billboards.** The reference the user wants (CodeSandbox `wzf2qm`)
also imports `Clouds, Cloud` from drei — proving the target look is achievable with this
technique. The gap was lighting + tone mapping, not the renderer.

## 4. Material choice — the real fork
drei lets `<Clouds material={...}>` override the per-instance material:

| | MeshLambertMaterial (default) | MeshBasicMaterial (drei docs example) |
|---|---|---|
| Reacts to lights | Yes | No (unlit) |
| Colour | `colour × texture × lighting` (greys if underlit) | `colour × texture`, always full |
| Form from light | Yes — bright tops, shadowed bottoms (photoreal) | None — form only from density overlap (flat/stylised) |
| Setup | Needs a real key light | Almost none |
| Tone mapping | Must disable ACES | Must *also* disable ACES (unlit white still greys) |

**Both still require `NoToneMapping`** — ACES greys white regardless of material.

- **Option 1 (chosen): MeshLambertMaterial + a strong key light.** Bright *and*
  dimensional — matches the real-sky Figma photo. What the reference CodeSandbox does.
- **Option 2 (fallback): MeshBasicMaterial.** Unlit, impossible to go grey, dead simple,
  cheap — but flatter / more graphic. Use only if Option 1's form is insufficient on our
  head-on fixed camera.

## 5. The fix (Option 1) — how
- **Disable ACES authoritatively:** `onCreated={({ gl }) => { gl.toneMapping = THREE.NoToneMapping }}`
  on `<Canvas>` (runs once at creation, persists across HMR). Keep it.
- **Re-light: key-dominant, not ambient-dominant.** A strong key light from above/front
  sculpts the bright→shadow gradient (form); a moderate ambient fill keeps undersides from
  going muddy. This **inverts** the previous ambient-2.2 / directional-0.5 setup. Reference
  uses a positioned `spotLight` (intensity 100, `decay={0}`) — positioned lights give the
  spatial gradient that flat directional/ambient can't.
- **Cloud colour stays `#ffffff`**; brightness comes from light, translucency from
  `opacity` (lets blue sky breathe at the feathered edges — the Figma softness).
- **Stay static** (`speed={0}`) and `frameloop="demand"` — the reference animates
  (`speed 0.1`) via a continuous render loop, which we deliberately avoid for the
  context-loss resilience and mobile cost. Form comes from lighting, not motion.

## 6. Where (files)
- `components/background/cloud-canvas.tsx` — `onCreated` (tone mapping), the `<ambientLight>` /
  key-light block, `<Clouds material=…>`, and the `LAYERS` opacity tuning. All cloud
  colour/lighting lives here.
- `components/background/background.tsx` — flat sky `#62abff` + grain (kept; user confirmed
  perfect). The reference leans on drei `<Sky>`; we deliberately keep the flat fill.
- `components/background/cloud-layer.tsx` — device gating (no-WebGL / reduced-motion / ≤768px).
  Unchanged.

## 7. Verification
Isolate the background canvas in the browser (raise its z-index, hide siblings), screenshot,
and sample with PIL. Targets: **peak cloud core ≥ ~250 (near-white)**, a **visible top→bottom
luminance gradient** (form, not a flat plate), and **feathered edges that blend to the blue
sky**. Compare side-by-side against Figma node `156:149`. Static checks: `npm run lint`,
`npx tsc --noEmit`.

## 8. Performance / resilience constraints (unchanged)
`frameloop="demand"`, static `speed=0`, single batched `<Clouds>` draw, self-hosted texture,
`frustumCulled={false}`, WebGL context-loss watchdog, device gating. None of this changes —
this is purely a colour/lighting pass.

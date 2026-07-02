# Fluid-simulation cursor

> **Historical.** This effect was removed and replaced by the DOM/glass custom
> cursor — see `docs/custom-cursor.md`. `components/cursor/` no longer contains
> `splash-cursor.tsx`; this file is kept for the lineage/rationale only.


A global cursor effect: the pointer splats swirling, dissipating colour across
the viewport. This is [React Bits' `SplashCursor`](https://reactbits.dev) — a
GPU fluid (Navier–Stokes dye/velocity) solver — vendored into the repo.

> Replaces the earlier custom `cursor-trail` (a curl-noise feedback shader
> ported from `cursor-trail-main/`). That component and its `cursor-trail*.ts(x)`
> files were removed; only this integration remains.

**Code:** `components/cursor/`

- `splash-cursor.tsx` — the vendored React Bits component (JavaScript variant),
  kept verbatim and exempted from strict TS/ESLint via file-top `@ts-nocheck` +
  `eslint-disable`. Treat as third-party; don't hand-edit the sim. It renders
  its own `position: fixed`, `pointer-events: none` full-viewport `<canvas>`.
- `cursor.tsx` — the device gate + mount decision (mirrors `cloud-layer.tsx`).
- Mounted at the root in `app/layout.tsx`, after `<CloudLayer/>`.

## Gating (`cursor.tsx`)

The effect only mounts when **all** of these hold, resolved through
`useSyncExternalStore` (server snapshot `false`, so SSR renders nothing and
re-evaluates after hydration — no mismatch, and it reacts to live changes):

- WebGL is available (probed once and cached; the probe context is released).
- `prefers-reduced-motion: no-preference` (accessibility).
- Screen wider than 768px and `pointer: fine` — a fluid *cursor* is meaningless
  on touch / coarse-pointer devices.

It's additionally deferred until the intro docks (`INTRO_REVEAL_EVENT`, with a
9s failsafe) so the fluid shaders don't compile against the glass MTM in the
most GPU-starved window (docs/performance-audit.md T1).

## Tuning

Props are passed in `cursor.tsx` (`<SplashCursor CURL={4} COLOR="#ffffff" />`).
See the props table in the React Bits docs — notably `RAINBOW_MODE` (default
`true`; cycles hues and **ignores** `COLOR`), `DENSITY_DISSIPATION` /
`VELOCITY_DISSIPATION` (how fast the splat fades), `CURL` (swirl), and
`SPLAT_FORCE` / `SPLAT_RADIUS`. To lock the effect to a single colour, set
`RAINBOW_MODE={false}` and give a `COLOR`.

## The fixed-canvas constraint

Like `<Background/>` / `<CloudLayer/>`, the canvas is `position: fixed`, so it
**must not** sit under any `filter` / `backdrop-filter` ancestor — a blurred
ancestor breaks `position: fixed` descendants (CLAUDE.md). That's why it's
mounted at the root, not nested inside a section.

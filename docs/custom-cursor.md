# Custom cursor

A plain white disc that follows the pointer. No hover effect, no glass — kept
deliberately trivial so it can never become a GPU cost.

> Replaces the fluid-simulation cursor (React Bits `SplashCursor`) and, before
> it, the curl-noise `cursor-trail` — both removed for being the page's dominant
> GPU cost (`docs/cursor-trail.md`, kept for history). An intermediate version
> added a glass-lens hover morph (reusing `<GlassSurface/>`); that was dropped in
> favour of the bare disc so there is zero per-frame filter work.

**Code:** `components/cursor/`

- `cursor.tsx` — the device gate + mount decision (mirrors `cloud-layer.tsx`).
- `cursor-visual.tsx` — the white disc + the pointer follow.
- Mounted at the root in `app/layout.tsx`, last child inside `<LenisProvider>`.

## Gating (`cursor.tsx`)

Mounts only when **all** hold, resolved through `useSyncExternalStore` (server
snapshot `false`, so SSR renders nothing — the native cursor stays — and it
re-evaluates after hydration, no mismatch, reacting live to a mouse being
plugged in or a devtools device toggle):

- `hover: hover` **and** `pointer: fine` — a custom cursor is meaningful only on
  a real mouse; touch / coarse / no-hover devices get the native cursor.
- Screen wider than 768px.

## Behaviour

| Context | Cursor |
|---|---|
| Real-mouse desktop (any browser / tier) | white disc follows the pointer |
| touch / coarse / no-hover / ≤768px / SSR | no custom cursor (native stays) |

The disc fades in on the first `pointermove` (its position is unknown until
then) and hides when the pointer leaves the window / the tab blurs, so it can't
get stuck in a corner.

## Why it can't leak

The follow is **event-driven**: each `pointermove` writes ONE composited
transform (`gsap.quickSetter` → `translate3d`). Pointer still → no events →
**zero work**. There is no rAF loop, no per-frame filter, and no canvas — so
none of the cloud/glass tier machinery applies, and the cursor reads no quality
tier. All listeners are removed and tweens killed on unmount.

## The fixed-element constraint

Like `<Background/>` / `<CloudLayer/>`, the cursor is `position: fixed` and
`pointer-events: none`, mounted at the root so it never intercepts clicks. (It
carries no `backdrop-filter` anymore, so the blurred-ancestor constraint that
governs the fixed sky layers no longer bites it — but the root mount is kept for
consistency.)

## Hiding the native cursor

`cursor: none` is **not** global (that would strip the cursor from touch / no-JS
/ SSR users). `cursor-visual.tsx` sets `document.documentElement.dataset
.customCursor = "on"` after mount, and `globals.css` scopes the rule to
`html[data-custom-cursor="on"]`. Cleared on unmount → native cursor restored.

## Tuning

In `cursor-visual.tsx`: the `DOT` diameter, the disc's `box-shadow`, and the
fade-in/out durations.

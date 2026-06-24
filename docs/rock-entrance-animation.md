# Rock entrance animation — options for review

The two cliffs (`left-rock.png` 357px, `right-rock.png` 344px) are full-height
cutouts pinned to the hero's bottom corners (`rock.tsx`, `z-0`, `object-bottom`).
They frame the central collage + text and, in the fiction of the scene, float in
a sky of volumetric clouds — **below their bottom edge is the cloud sea, not a
hard floor**. Today they simply appear; this doc captures the three entrance
directions we want to evaluate.

These are presented the same way the cloud look was: **all three ship behind an
on-screen selector** (mirroring the cloud Lit/Flat toggle in
`cloud-mode-toggle.tsx` + `cloud-mode.ts`), so the team can flip between them live
and pick a direction. The selector and the losing options come out once a choice
is locked.

The text reveal (`hero-reveal.tsx`) already runs a staggered slide-up cascade
(orders 1–7, ~1.4s, `expo.out`). The rock entrance should read as part of the
same on-load moment, not a separate effect.

---

> **Status:** all three options are implemented and live behind the **Rocks**
> selector (`rock-entrance-toggle.tsx`), above the cloud toggle. Flip it to A/B/C
> the cliffs' entrance live. Default is "rise" (Option A).

## Option A — Rise from the cloud sea

Each cliff starts parked **below the hero's bottom clip edge** and rises into
place (`translateY(100%) → 0`), as if emerging from the cloud sea beneath.

```
   before                          after
 ┌───────────────┐             ┌───────────────┐
 │               │             │▓▓           ▒▒│
 │               │             │▓▓▓         ▒▒▒│
 │               │     ──▶     │▓▓▓▓       ▒▒▒▒│
 │               │             │▓▓▓▓▓     ▒▒▒▒▒│
 │░░░ (clouds) ░░│             │▓▓▓▓▓▓   ▒▒▒▒▒▒│
 └───────────────┘             └───────────────┘
   cliffs parked below          rise up into frame
   the bottom clip edge         (translateY 100 → 0)
```

**Why this is the lead option:** it speaks the same visual language as the text
reveal (everything slides up from behind a clip edge) and it's narratively true
— cliffs rising out of clouds. Establishes the frame, then the text populates it.

- **Direction:** vertical, up. `yPercent: 100 → 0`.
- **Sequencing:** rocks rise **first**, before the text cascade — the foundation
  is laid, then the frame fills in. Also the one element that reads on a slow
  connection.
- **Symmetry:** slight left→right stagger (~100ms) — feels more crafted than a
  perfect sync.
- **Clip:** the hero already `overflow-hidden`s, so the rocks parked at `+100%`
  sit off the bottom with no extra wrapper needed.

## Option B — Slide in from the outer edges

Each cliff slides in horizontally from off-screen — left rock from the left edge,
right rock from the right — like curtains framing the stage.

```
 ┌───────────────┐             ┌───────────────┐
 │               │             │▓▓           ▒▒│
 │               │    ──▶      │▓▓▓         ▒▒▒│
 │←▓           ▒→│             │▓▓▓▓       ▒▒▒▒│
 └───────────────┘             └───────────────┘
   off-screen left/right        slide horizontally in
```

- **Direction:** horizontal. Left `xPercent: -100 → 0`, right `xPercent: 100 → 0`.
- **Trade-off:** striking and symmetrical, but slabs sliding sideways can read as
  UI panels rather than landscape — it slightly fights the "floating in sky"
  fiction.

## Option C — Settle / parallax-drift in

The softest option: a small downward drift (a few px) plus a fade, so the cliffs
read as "the camera finds them already there" rather than making an entrance.

- **Direction:** subtle. `opacity: 0 → 1` with a small `y` drift.
- **Trade-off:** keeps the text as the star and lets the rocks just breathe in.
  Safe fallback; least cinematic.

---

## Implementation notes

- Shared module store `rock-entrance.ts` (same shape as `cloud-mode.ts`:
  `useSyncExternalStore`, localStorage-persisted, SSR-safe default) holds the
  active option `"rise" | "slide" | "drift"`.
- `rock-entrance-toggle.tsx` mirrors `cloud-mode-toggle.tsx` for live switching.
- The animation is driven through the existing global GSAP instance (one ticker,
  via `lenis-provider.tsx`) — a plain on-load timeline, no ScrollTrigger needed
  for first paint, consistent with `hero-reveal.tsx`.
- Respects `prefers-reduced-motion` (rocks shown in place, no transform) and the
  no-JS / unarmed path (rocks visible), same gates as the text reveal.
</content>
</invoke>

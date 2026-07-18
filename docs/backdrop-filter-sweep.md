# The backdrop-filter sweep (2026-07-18)

## Why

A `backdrop-filter` element re-rasters its backdrop on **every scrolled
frame** — cost ∝ element area × blur radius, paid in Chrome's raster stage,
invisible to JS/rAF profiling. Measured on the prod build: the mid-page band
(cards → why-stay → pills → working-with) scrolled at 79–89 rAF/s; with only
`backdrop-filter` stripped (all other filters intact) it scrolled at a clean
**117–121**. A CPU profile of the band showed the main thread 70% idle — all
of the drag was this raster load. 15 live backdrop-filter elements existed in
that band, the largest a 1360×601 panel (817k px²), plus a blur(9.6px) card.

## The rule

**Frost only earns its raster cost when real content passes behind the
glass.** Over the fixed sky — a smooth static gradient — blurring produces the
same gradient back: full price, zero visible product. (This still holds when
the volumetric clouds return: they're soft-edged; blurring an already-soft
cloud is imperceptible.)

- **KEEP `backdrop-filter`**: navbar (page scrolls under it), why-stay
  GlassSurface (the reel refracts through it — the displacement IS the
  feature), mode-switcher rail (fixed; sections pass behind), cursor lens,
  portfolio tabs (globe tiles pass behind; tiny area).
- **DROP it** everywhere the backdrop is sky-only: card-shell, comparison
  panel + mobile cards, capability pills, pricing PlanCards, FAQ pills,
  subscribe-media pill, receive-media tile mats, the button `fill` variant.

## The veil

The frost did contribute one visible thing over sky: blurring the grain
overlay slightly lifted/smoothed the patch behind the glass, giving low-alpha
surfaces a touch of body (side-by-side, faint pills lost presence with a bare
strip). The stand-in is a **white inset veil** on the same element:

```
shadow-[inset_0_0_0_999px_rgba(255,255,255,0.06)]
```

Screenshot-verified equivalent on the standard glass recipe
(`border-white/30 · from-black/10→to-black/5`). Surfaces that already carry a
white fill (`bg-white/10`+) don't need it.

## When adding NEW glass

Ask: does anything other than sky ever pass behind this element? If no →
standard recipe + veil, **no backdrop-filter**. If yes → frost is allowed, but
it joins the KEEP list above and its area/blur should be as small as the
design tolerates.

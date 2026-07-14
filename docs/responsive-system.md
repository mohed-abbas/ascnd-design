# Responsive system (mobile pass)

**Status:** proposal — awaiting approval. No code has been written against this yet.

This is the single source of truth for making the site responsive. Every section
follows the rules here so the result is consistent instead of hand-tuned per
section. Read this before touching any section for mobile.

---

## 1. Scope & guarantees

- **Desktop is frozen.** The layout at **≥ 768px renders byte-for-byte identical
  to today.** The wide-screen behaviour the design was authored for — content at
  its fixed design pixels, centred, the fixed `<Background/>` sky/clouds
  expanding around it — is explicitly *not* touched. This pass adds a mobile
  layer *below* 768px only.
- **Mobile-only, CSS-only.** All responsive behaviour is expressed with Tailwind
  `max-md:*` variants and media-query token overrides. **No JS breakpoint
  branching in the render path** (no `innerWidth` / `navigator` reads to choose
  layout) — that would violate the codebase's SSR-stability contract and risk
  hydration mismatches. A stable server render + pure CSS media queries only.
- **No architecture regressions.** Responsive changes are layout-only. In
  particular: never introduce a `filter` / `backdrop-filter` on an ancestor of
  the fixed background layers (breaks `position: fixed`), and don't alter any
  heavy-effect / R3F internals — we resize their *containers*, not their guts.

---

## 2. The breakpoint

**One breakpoint: `md` = 768px** (Tailwind's default; already the site's mobile
boundary for clouds and glass).

- `max-md:*` → applies **below 768px** ("mobile"). This is where all our
  overrides live.
- Everything unprefixed → the untouched desktop design.
- A second breakpoint (`sm` = 640px) may be added **per-section, only when a
  section genuinely needs a phone-vs-small-tablet difference.** Default to the
  single 768 boundary; reach for `sm` only with a concrete reason, and note it in
  that section's mini-plan.

No new breakpoint tokens are defined — we use Tailwind defaults as-is.

---

## 3. Type scale (the shared tokens)

The string `text-[49px] leading-[1.1] tracking-[-1.47px]` is currently
copy-pasted across **9 sections**. We promote the sizes to fluid tokens so every
heading shrinks *identically* on mobile and stays *pinned* on desktop.

### Mechanism

Tokens are plain CSS custom properties on `:root`, mapped into Tailwind via the
existing `@theme inline` block (so the utility emits `var(--text-…)`, letting us
override the value under a media query). The **desktop value is the exact
current pixel size**; a single `max-width: 767.98px` block swaps in the fluid
value. That is what keeps ≥768 identical.

```css
/* globals.css */
:root {
  --text-display: 49px;   /* section headings — today's value, unchanged ≥768 */
  --text-hero:    56px;   /* hero H1 / pills lead */
  --text-body-lg: 20px;   /* pricing / lead paragraphs */
  --text-body:    16px;   /* body copy */
}

@media (max-width: 767.98px) {
  :root {
    --text-display: clamp(28px, 7.5vw, 40px);
    --text-hero:    clamp(32px, 9vw, 48px);
    --text-body-lg: clamp(16px, 4.4vw, 20px);
    --text-body:    clamp(14px, 4vw, 16px);
  }
}

@theme inline {
  --text-display: var(--text-display);
  --text-hero:    var(--text-hero);
  --text-body-lg: var(--text-body-lg);
  --text-body:    var(--text-body);
}
```

Utilities then read `text-display`, `text-hero`, `text-body-lg`, `text-body`.

### Coupled properties → make them size-relative so they scale for free

- **Letter-spacing:** convert px tracking to `em` so it tracks font-size instead
  of needing its own token. The design's `-1.47px @ 49px` and `-1.68px @ 56px`
  are both **`-0.03em`**; body `0.32px @ 16px` is **`0.02em`**. So headings use
  `tracking-[-0.03em]`, body `tracking-[0.02em]` — one value, scales with the
  token.
- **Line-height:** `leading-[1.1]` is already unitless — it scales automatically.

Net: a heading becomes `text-display leading-[1.1] tracking-[-0.03em]` and needs
**zero** per-breakpoint edits — the token does the work.

---

## 4. Spacing & gutters

- **Section rhythm:** keep `min-h-dvh` and the `py-[20dvh]` vertical padding
  pattern (it's viewport-relative, already fine on mobile). Trim to
  `max-md:py-[12dvh]` only if a specific section feels too airy on a phone.
- **Horizontal gutter:** mobile content must never touch the screen edge.
  Standard gutter is **24px per side** (`px-6`), which matches the hero's
  existing `calc(100vw - 3rem)` guard. Flow sections get `max-md:px-6` on the
  content column; spatial sections honour the same 24px inset.
- **Oversized fixed gaps** (e.g. `gap-[32px]`) may be reduced with `max-md:`
  where the design feels loose at phone scale — case by case, not mandatory.

---

## 5. The two archetypes

Every section is one of these. Its family decides its mobile treatment.

### Archetype A — Flow / text sections

Centred columns of type + actions. **Fluid tokens + wrap + stack is sufficient.**

Sections: `final-cta`, `faq`, `tagline`, `working-with`, and the heading/intro
blocks of `pricing` & `comparison`.

Recipe:
1. Swap hardcoded `text-[49px]…` for the type token
   (`text-display leading-[1.1] tracking-[-0.03em]`).
2. Remove forced single-lining on mobile: `max-md:whitespace-normal` (or drop
   `whitespace-nowrap` entirely where desktop doesn't need it).
3. Add the gutter: `max-md:px-6` on the content column.
4. Action rows stack and go full-width for tap targets:
   `flex ... max-md:flex-col max-md:w-full`, buttons `max-md:w-full`
   (optionally cap the stack, e.g. `max-md:max-w-[360px]`).
5. Trim gaps/padding with `max-md:` only if needed.

### Archetype B — Spatial / fixed-frame sections

Layouts positioned in absolute/grid **design pixels** against the 1512 frame
(34+ hardcoded placements). Font scaling does nothing here — they need a **real
mobile reflow**.

Sections: `hero`, `cards`, `testimonials`, `pills`, `why-stay`, `comparison`
(the matrix grid), `footer`.

Recipe:
1. **Reflow, don't shrink.** Below `md`, replace the absolute/grid px layout with
   a stacked flow layout (e.g. `max-md:static max-md:flex max-md:flex-col`, or a
   `max-md:hidden` desktop subtree + a `hidden max-md:block` mobile subtree when
   the two are too different to share markup).
2. **Reuse the shared vocabulary** — type tokens, 24px gutter, 768 breakpoint —
   so spatial sections read consistently with flow sections.
3. **Simplification is allowed.** Purely decorative spatial elements (rock orbit
   rings, scattered background pills, parallax offsets) may be repositioned,
   simplified, or `max-md:hidden` on mobile. Call out each such decision in that
   section's mini-plan before implementing.
4. **Heavy effects:** resize the *container*; never edit the R3F/canvas internals
   for layout. Tier/quality knobs stay owned by `lib/perf/tiers.ts`.
5. Each Archetype-B section gets a **short mini-plan** (its own reflow sketch)
   approved before code — they're too individual for a blanket recipe.

---

## 6. Invariants (the checklist every section change must pass)

1. **≥768 is visually unchanged** — diff the desktop render; nothing moves.
2. **No horizontal scroll / no clipping on mobile** — content fits within the
   section's `overflow-hidden` at 320–767px; nothing is cut off or spills.
3. **CSS-only, SSR-stable** — no JS width-branching in render; server and client
   first paint match.
4. **Tap targets ≥ 44px** for anything interactive on mobile.
5. **Fixed-background constraint respected** — no new `filter`/`backdrop-filter`
   ancestor of `<Background/>` / `<CloudLayer/>`.
6. **Tokens over literals** — new mobile type uses the scale in §3, not fresh
   `clamp()` strings per section (keeps the 9 headings in lockstep).

---

## 7. Section register

| Section        | Archetype | Mobile note |
|----------------|-----------|-------------|
| `final-cta`    | A | heading token + wrap; stack the two CTAs full-width. **First section — births the tokens.** |
| `faq`          | A | heading token; accordion pills already flow — width + gutter. |
| `tagline`      | A | already vw-fluid; align to the token where it overlaps. |
| `working-with` | A | drop `whitespace-nowrap`; token + gutter. |
| `pricing`      | A (heading) / B (cards) | heading flows; the two glass cards + dashed connector stack (mini-plan). |
| `comparison`   | A (heading) / B (matrix) | grid `grid-cols-[302.5px…]` reflows to stacked rows / horizontal scroll (mini-plan). |
| `pills`        | B | scatter field → stacked/simplified; decorative pills may be culled (mini-plan). |
| `why-stay`     | B | pinned reel — pin math + `shrink-0` wrapper are load-bearing (mini-plan). |
| `hero`         | B | rocks + navbar + text on the 1512 frame (mini-plan). |
| `footer`       | B | baked mountain composite + glass wordmark (mini-plan). |
| `testimonials` | B | 4 rocks + orbit rings around the quote; rings likely culled on mobile (mini-plan). |
| `cards`        | B | 3 media cards → vertical stack (mini-plan). |

---

## 8. Rollout order

Simplest → hardest, so the shared tokens land on the smallest possible surface
and each later section reuses a proven pattern:

1. `final-cta`  ← establishes the type tokens + Archetype-A recipe
2. `faq`
3. `tagline`
4. `working-with`
5. `pricing`
6. `comparison`
7. `pills`
8. `why-stay`
9. `hero`
10. `footer`
11. `testimonials`
12. `cards`

Archetype-A sections (1–4) are near-mechanical once the tokens exist.
Archetype-B sections (5–12) each get an approved mini-plan first.

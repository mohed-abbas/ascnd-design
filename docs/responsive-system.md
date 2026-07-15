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
| `tagline`      | A | ✅ vw/em-sized. Per request: a mobile-only break makes it read 3 lines on mobile ("look" / "like you" / "raised it.") vs 2 on desktop, and the font steps up (15.27vw → 26vw below md) so the text fills the narrow screen. Same bold left-aligned look; reveal structure unchanged. |
| `working-with` | A | drop `whitespace-nowrap`; token + gutter. |
| `pricing`      | A (heading) / B (cards) | ✅ Below md the absolute `h-[772.535px]` canvas becomes a flex column: cards stack full-width (subscription → sprint), badge reorders to `order-first` and straddles the subscription card's top edge via negative margin (Option A), connector arrow `max-md:hidden`. Inner fixed widths → `w-full`, features wrap, prices step 61→52px. Tokens applied throughout. |
| `comparison`   | A (heading) / B (matrix) | ✅ Heading flows (token + wrap). The 6-col grid can't shrink (long text cells), so below md the desktop card is `max-md:hidden` and a purpose-built **mobile stack** renders instead: one glass card per feature, each listing all 5 options with ascnd featured (`bg-white/10`). Rainbow aura dropped on mobile (needs an unclipped card). Both views carry `data-comparison-card` so the reveal rises whichever is shown. |
| `pills`        | B | ✅ Ambient drift/twinkle kept. Each pill has a second position (`mobileLeft`/`mobileTop`) switched in below md via CSS vars (`--dl/--dt` ↔ `--ml/--mt`, pure media query). Mobile = the designer's scattered cloud with each x compressed ~50% toward centre (keeps the irregular, non-list scatter, just narrower), plus 4 `mobileTop` nudges where compression pushed pills into the same row so none overlap. Mask fades all four edges below md. `pills-flow` reads the resolved `top` (getComputedStyle) since it's now a var. Headline reflows to a stacked, centred, token-sized cluster. |
| `why-stay`     | B | ✅ Reel font, `REEL_STEP`, `--reel-y`, pill and heading are all coupled (JS + CSS), so below md the whole 876×434 stage is scaled as one unit (`max-md:max-w-none max-md:scale-[0.4]`) — exact composition, smaller, zero JS/geometry changes. Pin, scrub, glass, reveal untouched. ⚠️ scale + backdrop-filter (glass) needs real-device verification. |
| `hero`         | B | rocks + navbar + text on the 1512 frame (mini-plan). |
| `footer`       | B | ✅ Already fluid by construction: `w-full` + `aspect-[1512/1243]` box holding a baked full-composite poster (`<Image fill object-cover>`, image aspect = box aspect → no crop), a full-width wordmark that scales with the viewport, and no flow text. The ≤768px gate already serves the poster (no WebGL) and the reveal is pixel-free. Only change: below md the box shortens to `aspect-[1512/900]` + `object-bottom` to trim the tall empty-sky headroom (dead space next to short scaled peaks on a phone) while keeping the full wordmark + mountains; ≥md unchanged (box aspect = image aspect → `object-bottom` is a no-op). |
| `testimonials` | B | ✅ The 3D rock canvas is already gated off ≤768px (flat PNG rocks below md), so mobile is pure DOM. The centred 1239×595 group is ~3× the phone width, so below md the block fills the section (`absolute inset-0`) and the four rocks + their orbit rings/dots re-anchor to the real viewport corners to frame the quote — each unit carries a mobile centre + scale (`mx`/`my`/`ms` in testimonials-data.ts) switched in via CSS vars (pills pattern); the scale rides the unit wrapper so the ring's revolve/reveal (on `[data-tm-ring]` inside) stays free, and the rock reads the same trio so rock+ring stay concentric. The quote **decouples** from the group and centres in the viewport at the fluid `text-display` token (scaling the whole group would shrink the quote to ~14px — unreadable). Reveal/quote-cycle untouched; on mobile the drift driver reproduces the desktop canvas entrance in the DOM — each PNG rock **flies in** from off-screen along its outward direction (`[data-tm-fly]`, GSAP x/y, shared REVEAL timing so it lands just before its ring draws in) and **spins** in the **opposite** direction of its ring (`[data-tm-rock]`), so rock and orbit counter-rotate. Rock markup is three independent transform levels (position+fly / scale / spin) so none fight. All `[data-tm-*]` rock layers are only in the fallback DOM — desktop rocks tumble in the canvas. |
| `cards`        | B | ✅ The three 440×438 media cards (media guts rigidly px-tuned with live GSAP) can't go fluid, so below md they reflow to a centred vertical stack, each card scaled to fit as ONE unit (why-stay's "scale, don't rebuild"). Each card sits in a `[data-card-scale]` wrapper — a plain `shrink-0` flex item on desktop (byte-identical: the same 440-wide item the article was) and the scale carrier on mobile. The scale rule lives in **globals.css** ("Card stack scale" block, keyed off `[data-cards-row]`): `--card-s = min(1, tan(atan2(100vw−48px, 440px)))` with a `0.72` fallback line before it (engines without `tan/atan2` drop the invalid later value and keep the number). `tan(atan2(a,b))≡a/b` is used because `scale()` needs a unitless number and CSS calc can't divide a vw-length by a length to get one. origin-top `scale()` + a negative `margin-bottom` collapsing the leftover layout height packs the stack tight. Scale is on the wrapper, not `[data-card-shell]`, so `cards-reveal`'s transform/blur on the article stays free. (First cut put the scale in Tailwind `max-md:` classes with `display:contents` wrappers — the `contents`→`block` swap didn't win the cascade, so the transform never landed and the cards stayed full-width/cropped; moving to globals.css with a real wrapper fixed it.) Section un-pins to `flex-col`, heading un-pins + token-sized. ⚠️ backdrop-blur (shell + shot tiles) under `scale` needs real-device verification (same caveat as why-stay). |

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

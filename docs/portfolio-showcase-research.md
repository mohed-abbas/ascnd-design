# Portfolio showcase — architecture research & decision record

> Authoritative reference for the **`SectionProjectShowcase`** ("stuff we've shipped")
> section: the rotating card-wheel gallery. Read this before building or touching
> the section. Written 2026-07-08 from an analysis of the Figma final state plus
> the two motion references the design is based on.
>
> **TL;DR — the whole section is a giant rotating _wheel_ of cards. The "3D feel"
> is a 2D illusion (rotation around a pivot placed far below the screen), not real
> 3D. Build it in DOM + CSS transforms + GSAP ScrollTrigger. Do NOT add a second
> WebGL context.**
>
> **STATUS (2026-07-08): the scroll-jack rotation (§6) and the load reveal (§8)
> were BUILT then REVERTED — the section is currently the STATIC arc only
> (structure + caption, no motion), pending a new animation direction. The
> mechanism analysis, WebGL decision, and geometry below remain authoritative for
> whatever animation replaces them; §6 and §8 describe the reverted approach and no
> longer reflect the code.**

---

## 1. What the section is

A horizontal **arc of project cards** floating over the existing sky/cloud layers.
At rest (the Figma "final state", node `435:515`, frame `1512×982`):

- **5 cards visible:** one **upright center card**, an **inner pair** tilted ~±8°,
  and an **outer pair** tilted ~±16° that bleed off both screen edges.
- The card group is **1913px wide inside a 1512px frame** — deliberately wider than
  the viewport (~200px clipped each side). That overflow is the visual hint that
  you're looking at the top slice of something larger.
- Every card is identical geometry: **296×424, 20px radius, 1.5px white border**, a
  faint black top→bottom gradient (`rgba(0,0,0,0.1)`→`0.05`), and the image with a
  **2px backdrop-blur**. Titles + `brand`/`web` pills sit **below each card and
  rotate to match its tilt** (center title upright; project-1 title ~-8°, project-3
  title ~+8°).
- Below the arc, centered: **"stuff we've shipped"** (Product Sans Light + Instrument
  Serif on *"shipped"*, 49px, tracking -1.47px) and a glossy white **"see all work"**
  pill (`#263138` text, white→`#efefef` gradient, inset shadow).
- Content count: **10–12 projects** (Figma currently uses placeholder images).

The cards float over the sky. Their `backdrop-blur` is safe here because cards are
**content siblings above** the fixed `Background`/`CloudLayer`, never ancestors of
them — the same reason the navbar blur is allowed (see the layout constraint in the
root docs). No `filter`/`backdrop-filter` may ever land on an *ancestor* of the fixed
layers.

---

## 2. The core mechanism — one wheel, one distant pivot

The single idea behind the whole section. From the CodePen reference, the effect is
**three CSS rules**:

```css
.items {
  transform-origin: center 200vh;  /* pivot 2 screen-heights BELOW the row's center */
  transform: rotate(0);            /* rotating THIS spins the entire ring */
  display: flex;
}
.item { position: absolute; transform: translateX(-50%); }  /* all stacked at one point */
```

Every card sits at the **same** point, then each is rotated by
`index × (360 / total)` degrees **around that pivot far below the viewport**. Because
the radius is enormous (~200vh), the top few cards spread into a **shallow, gentle
arc** — top card upright, neighbours tilting progressively, outer ones clipping off
the edges.

**That arc is exactly the Figma final state.** The ±8° / ±16° tilts are just `degree`
steps of this wheel. There is **no perspective, no `rotateY`, no camera** — only 2D
`rotate()` around a distant origin. The Figma "final state" is one frozen frame of
this wheel.

Rotating the whole `.items` element by `degree` brings the next card up to top-center.
That's the entire interaction model: **scroll (or drag) → rotate the wheel.**

---

## 3. Reference 1 — the load animation

**Source:** `https://codepen.io/d3adr4bbit/pen/RwvmGzV` ("Interactive Image Gallery",
by @deadrabbbbit, itself inspired by a Hyundai / Kona Digital site).
**Stack:** GSAP 3.12 + Draggable. **Pure DOM/CSS. Zero WebGL, zero Three.js.**

The `init()` timeline, decoded from source, per card (all on one timeline from t=0):

- **`gsap.set`** — initial scatter `rotation` (sign alternates every 2 cards, magnitude
  grows every 4) and `scale: 0.5`.
- **Act 1 · Fly-in** (`timeline.from`, at t=0): each card starts **far off-screen**,
  alternating left/right by index parity (`±(innerWidth + cardW×4)`), **`y`** from below
  (`innerHeight − cardH`), **`rotation ±200°`**, **`scale 4`**, `opacity 1`,
  `ease power4.out`, `duration 1`, **`delay 0.15 × floor(index/2)`**. → cards hurl in
  from both sides in **staggered pairs** (one per side per beat), huge and spinning,
  decelerating into a **stack near center**.
- **Act 2 · Unfurl** (at `t = 0.15 × (N/2 − 1) + 1`): snap `scale → 1`, then rotate each
  card to its final wheel angle (`index × degree`, mirrored past the halfway index),
  `transformOrigin: center 200vh`, `duration 1`, `ease power1.out`. → the stack **fans
  open** into the resting arc.

**Interaction in the pen:** `Draggable.create('.items', { type: 'rotation' })` with
snap-to-nearest-card on release. (In our build, **scroll** replaces drag — see §4.)

We adapt this as the section's **reveal animation**, hooked into the existing
intro/reveal gate rather than firing on page load.

---

## 4. Reference 2 — the scroll behaviour

**Source:** `https://ten.375.studio/en/about` ("Ten Years Away", Studio375).

Confirmed by live inspection:

- The page is **one full-screen WebGL2 canvas** (`getContext('webgl2')`, 1512×982).
  Native scroll is **hijacked** — `document.scrollHeight === innerHeight` — and fed
  into the WebGL scene. Libraries are bundled (not on `window`).
- Driving the scroll **rotated the wheel**: an entirely fresh set of cards cycled
  through the top arc (BLONDE/CHICA/FINANCIAL → VEGETARIAN/DANNY/HEARTTHROB/CHATTER),
  the top-center card upright and prominent, titles rotating with each card.
- **It is the same wheel as the CodePen.** The only differences: (1) rotation driven by
  **scroll** instead of drag, and (2) rendered in WebGL purely for a **material
  aesthetic** — paper grain, hand-inked comic texture, subtle warp. The *geometry*
  gains nothing from WebGL.

---

## 5. Decision — DOM/CSS/GSAP, not WebGL

**Build the section in DOM + CSS transforms + GSAP ScrollTrigger. Do NOT add a second
WebGL context.** Rationale:

1. **The layout is 2D by nature.** The CodePen proves the exact arc + fly-in + unfurl
   is fully achievable with `rotate/scale/x/y` + GSAP. WebGL adds nothing to the geometry.
2. **ten.375's WebGL only buys a material look** (paper/ink texture), and we already have
   that vocabulary in DOM: the site-wide grain overlay, frosted `backdrop-blur` cards,
   white borders + gradients straight from the Figma.
3. **The WebGL budget is already spent on the clouds**, under the strict heavy-effect
   contract (rides the shared GSAP ticker, idles to zero, tier-aware, dpr ≤ 1.5,
   SSR-stable). A second context fighting the clouds for the GPU is a large ongoing cost
   for a flat card fan.
4. **DOM wins the boring-but-critical stuff:** 10–12 images get browser-native
   lazy-load/decode/memory, crisp text, a real `<a>` on "see all work", accessibility,
   and reduced-motion — all far harder inside a canvas.

**Consciously given up:** ten.375's per-pixel ink warp on the imagery. Not worth a
second WebGL context. We match its *soul* (arc, motion, grain, texture) in DOM.

**Fits our existing infra:** Lenis + GSAP + ScrollTrigger on one shared ticker is exactly
what this needs — scroll progress → wheel rotation → DOM transforms, the same pattern as
the cloud parallax. No competing schedulers, no private rAF.

---

## 6. Rotation driver — DECIDED: pinned / scroll-jacked

**Locked (2026-07-08): pinned / scroll-jacked**, matching ten.375. The section **pins to
the viewport** and the wheel spins *in place* while the user scrolls; the page does not
advance past the section until the wheel has cycled through its cards. More immersive,
heavier-handed — the intended feel.

Implementation shape (Phase 2): a ScrollTrigger with `pin: true` and `scrub`, whose
progress (0→1 over a scroll distance ≈ N × per-card) maps linearly to `.items`
rotation. Rides the shared Lenis/GSAP ticker — no private rAF. Reduced-motion: skip the
pin, render the resting arc, let the section scroll normally.

*(Rejected alternative — flow-through: wheel rotates as the section scrolls past
normally, no pin. Lighter but less immersive; not chosen.)*

---

## 7. Build sequence

Phased, approval-gated (same rhythm as the theme controller). Do NOT jump ahead.

| Phase | What | Motion source |
|---|---|---|
| **1 — Static wheel** | Resting arc in DOM via the `center 200vh` pivot, pixel-matched to Figma: 5 visible cards, titles+pills, heading + CTA. Real slots for 10–12 projects. | none |
| **2 — Scroll rotation** | ScrollTrigger maps scroll progress → wheel rotation (§4). Top-center card reads as "focused". | scroll |
| **3 — Load animation** | The CodePen fly-in → unfurl (§3), played on section reveal via the existing intro/reveal gate. | timeline |
| **4 — Data + polish** | Real project data, responsive/mobile, reduced-motion fallback, perf pass against the tier system. | — |

---

## 8. Phase 3 — load animation (LOCKED spec, revised 2026-07-08)

Nothing is present when the section arrives — not the cards AND not the heading. A
dedicated EMPTY SPACER (~1 screen of sky) precedes the section, so leaving
WorkingWith gives a deliberate empty beat. The reveal order is **cards first, then
the heading** — the trigger is NOT the heading appearing:

```
STAGE 0  empty spacer      → open sky; NO cards, NO heading (scroll through it)
STAGE 1  section LOCKS      → pin engages; viewport still empty; triggers reveal
STAGE 2  fly-in            → cards hurl in from far L/R in staggered pairs,
                             huge + spinning (±200°), stacking at centre
STAGE 3  unfurl            → the stack fans out around the pivot into the arc
STAGE 4  caption           → ONLY NOW the heading + text + CTA fade + rise in place
STAGE 5  all together      → cards + heading + CTA coexist; reveal complete
STAGE 6  further scroll    → the wheel rotation scrub (0° → −56°)
```

Pin timeline (one pin, three acts then the scrub):

```
 PIN ▼──┬── ① fly-in → unfurl ──┬── ② caption fade/rise ──┬── ③ WHEEL ROTATION ──► RELEASE
        │      scroll FROZEN (acts ① + ②)                 │  scroll-scrubbed
```

Decisions:
- **Empty lead-in = a dedicated spacer** (~1 screen) before the section, not part of
  the pinned section (it just scrolls past).
- **Order = cards, THEN heading.** Cards fly in / unfurl with the heading hidden;
  the heading + CTA fade/rise in place (pinned) only after the arc forms.
- **Reveal driver = TIME-BASED autoplay.** On lock, acts ① + ② play over ~3.4s with
  scroll FROZEN (Lenis `stop()`/`start()` via `useLenis()`), then released into the
  rotation scrub.
- **Replays on EVERY re-entry** (`onEnter` + `onEnterBack`), re-arming hidden on
  exit (`onLeave` + `onLeaveBack`). ⚠️ Freezes scroll each re-entry — easy to soften.
- **Rotation stays at progress 0 during the freeze**, so the reveal's landing state
  IS the rotation start — no conflict.

Implementation shape (mirrors WhyStay's arming):
- Resting inline state shows the full arc + caption → **no-JS / reduced-motion**
  render everything static, no fly-in.
- Under `no-preference`, `gsap.set` arms the hidden start BEFORE paint. Cards split
  OUTER (arc rotation, far pivot) / INNER mover (fly-in, own centre). The caption's
  centring lives on a wrapper; the animated inner `[data-showcase-caption]` only
  fades + rises (y), so its transform never fights the −translate-x-1/2.

## 9. Figma reference

- File: `xdVT4yxPrYM1R6yX8XJRvr` (Startup)
- Final-state node: `435:515` — `SectionProjectShowcase`, `1512×982`
- Card group: `435:516` — `1913.29 × 722`, centred, overflows the frame ±200px
- Center (upright) card: `435:525` / `435:526`
- Inner/outer card wrappers: `435:517`–`435:520` (rotations encoded via Figma's
  `-scale-y-100 rotate()` mirror artifacts; net visual ≈ symmetric ±8° / ±16°)
- Heading + CTA: `435:521` (`stuff we've shipped` + `see all work`)
- Card base geometry: `296×424`, radius `20`, border `1.5px` white, image `backdrop-blur 2px`

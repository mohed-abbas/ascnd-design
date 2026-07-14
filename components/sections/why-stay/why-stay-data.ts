/**
 * "why teams stay" reel copy + geometry. Shared by the markup (why-stay.tsx) and
 * the scrubbed driver (why-stay-reveal.tsx) so the phrase count and the per-step
 * distance can never drift apart.
 *
 * The reel is a vertical stack of these phrases; only the one framed by the glass
 * pill reads bright (a magnified "lens" copy sits over it). REEL_STEP is the
 * centre-to-centre distance between consecutive phrases: the Product Sans line box
 * (~91px at 95px/0.961) plus the design's 27px gap (Figma 302:1452).
 */
export const PHRASES = [
  "one flat rate",
  "fast turnarounds",
  "senior only",
  "design and code",
  "flexible",
  "100% yours",
] as const;

export const REEL_STEP = 118; // px between phrase centres (91px line + 27px gap)

// Scroll consumed per phrase while the section is PINNED (slower = softer
// glide). Lives here (not in why-stay-reveal.tsx) because the pin's total
// length is also consumed by the static cloud layer's why-stay conveyor
// (static-cloud-specs.ts) — one source, so reel and clouds can't drift apart.
export const PER_PHRASE = 420;

// Total extra scroll the pin adds to the section's crossing.
export const WHYSTAY_PIN_EXTRA = PER_PHRASE * (PHRASES.length - 1);

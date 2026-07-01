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

/**
 * Content + layout specs for the "AimatedCards" section (Figma node 220:1418).
 * Kept data-driven so the inner mockups can be looped/animated later (the cards
 * carry auto-running infinite animations — see request rows + shot grid).
 *
 * All numbers are the raw Figma px off the 1512×982 design frame; the section
 * renders at design scale, centered, matching the hero's convention.
 */

export const CARD_COPY = {
  subscribe: "pick a plan. you're onboarded to your own request board in about an hour.",
  request: "add as many requests as you want. brief it in text, a doc, or a loom. we work one at a time.",
  receive: "work back in a few business days on average. revise until it's right.",
} as const;

/** Placeholder shown in every request-input row (Card2, Figma 140:13791). */
export const REQUEST_PLACEHOLDER = "request anything...";

/** The category tag on each request-input row, top→bottom. */
export const REQUEST_TAGS = ["UI/UX", "Design", "Wireframe", "UI/UX", "UI/UX"] as const;

export type ShotTile = {
  src: string;
  alt: string;
  /** Rect within the 594×510 grid plane (Card1). */
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Card1 "receive" design-shot collage — 4 tiles in a 594×510 plane. */
export const SHOT_TILES: ShotTile[] = [
  { src: "/cards/shot-finance.png", alt: "Fintech dashboard concept", x: 0, y: 0, w: 295, h: 224 },
  { src: "/cards/shot-weightloss.png", alt: "Health app landing page", x: 1, y: 233, w: 294, h: 277 },
  { src: "/cards/shot-collage.png", alt: "Eyewear brand photography", x: 307, y: 49, w: 250, h: 234 },
  { src: "/cards/shot-taskma.png", alt: "Task manager web app", x: 306, y: 290, w: 288, h: 207 },
];

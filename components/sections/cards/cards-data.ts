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

/** The request board rows (Card2, Figma 140:13791). The first is the ACTIVE
 *  row — it expands and types out the brief — the rest are the queue below. */
export const ACTIVE_REQUEST = { task: "new landing page", tag: "UI/UX" } as const;
export const REQUEST_QUEUE = [
  { task: "saas marketing site", tag: "Design" },
  { task: "front-end build", tag: "Dev" },
  { task: "brand identity kit", tag: "Brand" },
  { task: "pitch deck design", tag: "Design" },
] as const;

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
  { src: "/cards/shot-finance.avif", alt: "Fintech dashboard concept", x: 0, y: 0, w: 295, h: 224 },
  { src: "/cards/shot-weightloss.avif", alt: "Health app landing page", x: 1, y: 233, w: 294, h: 277 },
  { src: "/cards/shot-collage.avif", alt: "Eyewear brand photography", x: 307, y: 49, w: 250, h: 234 },
  { src: "/cards/shot-taskma.avif", alt: "Task manager web app", x: 306, y: 290, w: 288, h: 207 },
];

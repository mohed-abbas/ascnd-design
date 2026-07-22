/**
 * Copy + config for the "your first month, plotted" timeline (Figma 746:4125).
 *
 * The five milestone beats (day 1 → day 23) and the banked-days grid. Positions
 * and per-beat widgets live in timeline.tsx (each card is bespoke); this file is
 * the words + the calendar state so copy edits don't touch layout.
 */

export const HEADING = {
  // Rendered split: Product Sans Light lead + Instrument Serif accent on "plotted".
  lead: "your first month, ",
  accent: "plotted",
  sub: "what actually happens after you subscribe",
} as const;

// The tiny labels floating on the curve / at the end (Figma 746:4425 / 746:4536).
export const DESIGNS_IN_REVIEW = "Designs in review";
export const AND_UP_WE_GO = "and up we go";

export type Beat = {
  key: "subscribe" | "first-request" | "delivery" | "revised" | "pause";
  day: string;
  title: string;
  body: string;
};

export const BEATS: readonly Beat[] = [
  {
    key: "subscribe",
    day: "day 1",
    title: "you subscribe",
    body: "your request board is live in about an hour. add everything on your mind.",
  },
  {
    key: "first-request",
    day: "day 2",
    title: "first request in progress",
    body: "we pull the top of your queue and start. no kickoff meeting needed.",
  },
  {
    key: "delivery",
    day: "day 5",
    title: "first delivery lands",
    body: "real design, and real code where it matters. straight to your board.",
  },
  {
    key: "revised",
    day: "day 12",
    title: "revised until right",
    body: "feedback goes in, revisions come back. then we pull the next request.",
  },
  {
    key: "pause",
    day: "day 23",
    title: "queue empty? pause.",
    body: "pause the subscription and keep every unused day for when you're back.",
  },
] as const;

/** Look up a beat's copy by key (cards are placed individually in timeline.tsx). */
export const beat = (key: Beat["key"]): Beat =>
  BEATS.find((b) => b.key === key)!;

/**
 * The "11 days banked" calendar (Figma 746:4444). A 7-wide grid of day cells:
 *   • solid — a full/available day (bright white)
 *   • muted — a spent day (dimmed)
 *   • check — a banked day (white cell with a tick)
 * The last row is short (3 cells), as in the design.
 */
export type Cell = "solid" | "muted" | "check";

export const BANKED_GRID: readonly (readonly Cell[])[] = [
  ["solid", "solid", "solid", "solid", "solid", "solid", "muted"],
  ["muted", "muted", "muted", "muted", "muted", "muted", "muted"],
  ["muted", "muted", "muted", "check", "check", "check", "check"],
  ["check", "check", "check", "check", "check", "check", "check"],
  ["solid", "solid", "solid"],
];

export const BANKED_LABEL = "11 days banked";

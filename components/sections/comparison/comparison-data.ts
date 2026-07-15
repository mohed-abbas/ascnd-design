/**
 * "comparisonSection" data — Figma node 469:549 (frame 420:412, 1512×982).
 *
 * A 6-row × 5-column feature matrix comparing ascnd against the alternatives.
 * The first data column ("ascnd") is the featured option — every cell is a
 * check, and it's rendered with a highlighted panel in comparison.tsx.
 *
 * A cell is one of:
 *   • "check" — the two-tone tick glyph (feature fully covered)
 *   • "dash"  — the two-tone minus glyph (not covered)
 *   • string  — a muted qualifier ("months to start", "varies", …)
 */

/** Column headers, in render order. `ascnd` is the featured (highlighted) one. */
export const COMPARISON_COLUMNS = [
  "ascnd",
  "in-house hire",
  "agency",
  "freelancer",
  "match-me sub",
] as const;

export type ComparisonCell = "check" | "dash" | (string & {});

export interface ComparisonRow {
  /** Row label, left-aligned in the first column. */
  readonly label: string;
  /** One cell per column in COMPARISON_COLUMNS order. */
  readonly cells: readonly [
    ComparisonCell,
    ComparisonCell,
    ComparisonCell,
    ComparisonCell,
    ComparisonCell,
  ];
}

export const COMPARISON_ROWS: readonly ComparisonRow[] = [
  { label: "speed", cells: ["check", "months to start", "weeks", "check", "check"] },
  {
    label: "senior quality every time",
    cells: ["check", "check", "varies", "varies", "lottery"],
  },
  {
    label: "ships real code",
    cells: ["check", "design only", "extra scope", "sometimes", "dash"],
  },
  { label: "pause anytime", cells: ["check", "dash", "dash", "check", "check"] },
  {
    label: "one team that knows you",
    cells: ["check", "check", "rotating", "solo", "dash"],
  },
  {
    label: "predictable cost",
    cells: ["check", "salary + benefits", "scope creep", "hourly drift", "check"],
  },
];

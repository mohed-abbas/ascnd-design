/**
 * Grid-mode layout maths — the numbers behind the masonry wall
 * (docs/portfolio-grid-mode.md §8).
 *
 * Deliberately free of React and of the DOM: it is a pure function of the
 * project list, so the wall a given filter produces is deterministic and can be
 * reasoned about (and later tested) without a browser.
 */
import type { CloudProject, ProjectForm } from "../cloud-canvas/cloud-canvas-data";

/**
 * Tile aspect (width ÷ height) per authored form.
 *
 * These are the globe's own SLOT_SIZE ratios (cloud-canvas-engine.ts), NOT new
 * numbers: every source in public/portfolio/cloud/ has already been cropped to
 * one of them by scripts/optimize-portfolio-images.mjs, so the wall inherits
 * framings that were art-directed once. A tile whose CSS aspect disagreed with
 * its crop would letterbox or re-crop the shot a second time.
 *
 *   landscape 164×104 → 1.577   (the shortest tile)
 *   square    126×126 → 1.000
 *   portrait  112×146 → 0.767   (the tallest — ~2:1 against landscape)
 *
 * That 2:1 spread IS the masonry effect (§8.1). The wider `tall` form that
 * would push it to ~3:1 is deferred to D8/D11 — deliberately, not forgotten.
 */
export const GRID_ASPECT: Record<ProjectForm, number> = {
  landscape: 164 / 104,
  square: 1,
  portrait: 112 / 146,
};

/** Ceiling on desktop columns (D3). */
export const DESKTOP_MAX_COLUMNS = 4;
/** Floor, and the fixed count on a phone (D3). */
export const MIN_COLUMNS = 2;
/**
 * The sparse-filter floor (§8.2). A column built from fewer tiles than this
 * repeats itself ON SCREEN: at 3 tiles a column stands ~1.3 viewports tall, so
 * a given tile can appear at most twice at once. At 2 it appears three or four
 * times and the wall reads as a loop, not a body of work.
 */
export const MIN_TILES_PER_COLUMN = 3;

/**
 * How many columns a set of `total` projects gets.
 *
 * The globe answers sparsity by GROWING tiles (densityFactors shrinks spread
 * and grows size — it is why the brandings tab once reached 93.8% of screen
 * width per tile on a phone). The grid must not: a bigger tile in a fixed-width
 * column means a WIDER column, and it stops being a wall. So tile size is held
 * constant and the column COUNT drops instead; the field simply narrows and
 * re-centres.
 *
 *   all(24) → 4      web(10) → 3      misc(8) → 2      brandings(6) → 2
 *
 * Mobile is always 2 — its columns are already narrow enough that dropping to
 * one would make a single-file feed, not a wall.
 */
export function columnCount(total: number, isMobile: boolean): number {
  if (isMobile) return MIN_COLUMNS;
  const byDensity = Math.floor(total / MIN_TILES_PER_COLUMN);
  return Math.max(MIN_COLUMNS, Math.min(DESKTOP_MAX_COLUMNS, byDensity));
}

/**
 * Deal the projects into columns, shortest-column-first — classic masonry.
 *
 * Heights are compared in UNIT terms (a tile of width 1 is 1/aspect tall), so
 * the balancing is resolution-independent: the same wall comes out at any
 * column width.
 *
 * Input order is the registry order (cloud-canvas-data.ts), which already
 * rotates web → branding → misc specifically so a contiguous run can't clump
 * one type — and because type correlates with form (web is nearly all
 * landscape, branding mostly portrait), that rotation is also what keeps a
 * single column from filling up with one SHAPE. A rule written for the globe
 * that pays off again here.
 *
 * Deterministic: same projects + same count → same wall, every render.
 */
export function assignColumns(
  projects: CloudProject[],
  columns: number,
): CloudProject[][] {
  const buckets: CloudProject[][] = Array.from({ length: columns }, () => []);
  const heights = new Array<number>(columns).fill(0);

  for (const project of projects) {
    // Ties go to the LEFTMOST column (indexOf on the min), which keeps the
    // first row filling left-to-right instead of scattering.
    let target = 0;
    for (let i = 1; i < columns; i++) {
      if (heights[i] < heights[target]) target = i;
    }
    buckets[target].push(project);
    heights[target] += 1 / GRID_ASPECT[project.form];
  }

  return buckets;
}

/**
 * Glass-mat metrics as fractions of the COLUMN width, for the CSS container
 * query in portfolio-grid.tsx (D10).
 *
 * The recipe is the design-shots / conveyor-arc one the globe also draws
 * (cloud-canvas-engine.ts drawCard step 1–4): corner 14/261 of the tile edge,
 * mat ring 6.39/261 (SHOT_MAT_RATIO 0.0245 × SHOT_BASE 261), 1px white/40
 * hairline, inset white sheen filling the ring.
 *
 * ⚠️ ONE deliberate deviation. The engine bases both on `min(w, h)` of the tile,
 * because on the sphere a tile's on-screen size varies by depth — the mat has
 * to track the tile or it would look pasted on. In a wall every tile shares one
 * width, and a mat that tracked each tile's own height would give the short
 * landscape tiles a visibly thinner border than the tall portraits, in the same
 * row, at the same distance. So the base here is the COLUMN width: one mat
 * weight for the whole wall. Same recipe, correct base for a flat layout.
 */
export const MAT_RATIO = 0.0245;
export const RADIUS_RATIO = 14 / 261;

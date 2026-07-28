/**
 * Grid-mode layout maths — the numbers behind the masonry wall
 * (docs/portfolio-grid-mode.md §8).
 *
 * Deliberately free of React and of the DOM: it is a pure function of the
 * project list, so the wall a given filter produces is deterministic and can be
 * reasoned about (and later tested) without a browser.
 */
import type { CloudProject, GridForm } from "../cloud-canvas/cloud-canvas-data";

/**
 * Tile aspect (width ÷ height) per authored form.
 *
 * These are the globe's own SLOT_SIZE ratios (cloud-canvas-engine.ts), NOT new
 * numbers — the wall and the sphere frame the same project identically.
 *
 * ⚠️ The sources are NOT pre-cut to these ratios, and an earlier version of this
 * comment claimed they were. Measured, public/portfolio/cloud/ arrives as 1.779
 * (×6), 1.333 (×8), 1.000 (×5), 0.667 (×4) and a single 0.767: only
 * emerald-poster-help sits on a slot aspect, and it is the ONE entry in the
 * optimize script's CROPS map (an off-centre focus the runtime can't express —
 * a centred cut there bisects the wordmark). Every other tile is cropped at
 * DRAW time: the engine calls drawImageCover, and the wall's `object-cover` is
 * that same centre-crop expressed in CSS.
 *
 * So the ratio below is a crop INSTRUCTION, not a description of the file —
 * which is also why nothing here can letterbox. The cost of that is resolution,
 * not framing: a 4:3 source cropped into the portrait slot keeps only 0.767 of
 * its width, so 8 of 24 tiles under-resolve a 380px column at 2× DPR. That is
 * the measured case for §9's dedicated grid preset, and it is independent of
 * any byte argument.
 *
 *   landscape 164×104 → 1.577   (the shortest tile)
 *   square    126×126 → 1.000
 *   portrait  112×146 → 0.767   (the tallest — ~2:1 against landscape)
 *
 * That 2:1 spread IS the masonry effect (§8.1). The wider `tall` form that
 * would push it to ~3:1 is deferred to D8/D11 — deliberately, not forgotten.
 */
export const GRID_ASPECT: Record<GridForm, number> = {
  landscape: 164 / 104,
  square: 1,
  portrait: 112 / 146,
  /**
   * `tall` (D8) — the full-length slot, and the ONE aspect here with no
   * counterpart on the globe (see `GridForm`).
   *
   * 0.6, and the ceiling is the whole argument (§16.1). The source designs are
   * far taller — the first one in is 1440×4816, or 0.299 — and the temptation
   * is to show them at their real proportion. That is a mistake in a MOVING
   * wall, which is what separates this from Pinterest's static one:
   *
   *   at 0.6   a 380px column → 633px tall → ~21s to cross at 30px/s
   *   at 0.5   a 380px column → 760px tall → ~25s   (Pinterest's own cap)
   *   at 0.299 a 380px column → 1271px tall → ~42s, and TALLER THAN THE WALL
   *
   * A tile that outlives the wall it travels through stops reading as one item
   * among many and becomes a column of its own, and at 42s a visitor never sees
   * it leave. Height multiplied by motion is a cost a static grid never pays.
   *
   * So the wall shows a 0.6 CROP of the top — the hero, which is the part that
   * identifies a landing page — and the whole design lives in the expand, which
   * scrolls (grid-expand.tsx). That split is exactly what §8/§15.3 called for:
   * "the long-form shot belongs in the EXPAND, not the wall".
   */
  tall: 0.6,
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
 * The shape a project takes IN THE WALL — `grid.form` when set, otherwise the
 * globe's `form`.
 *
 * Every consumer of a tile's aspect must go through this, and the reason is a
 * bug this replaced: `assignColumns` and the tile's own `aspectRatio` both read
 * `project.form` directly while the expand read the override, so a project that
 * used `grid.form` was BALANCED as one shape and RENDERED as another. Harmless
 * while the override was unused; the moment `tall` landed it would have dealt
 * the columns against a 0.767 tile and then drawn a 0.6 one, leaving the
 * masonry visibly unbalanced with no obvious cause.
 */
export function wallForm(project: CloudProject): GridForm {
  return project.grid?.form ?? project.form;
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
    heights[target] += 1 / GRID_ASPECT[wallForm(project)];
  }

  return buckets;
}

/**
 * Base drift speed, in CSS px per second.
 *
 * Authored in px/sec rather than a duration so a column's speed does not depend
 * on how tall it happens to be — the same reason logos-marquee.tsx does it
 * (`SPEED = 40`). A column of 6 tiles and a column of 3 must LOOK equally slow;
 * with a fixed duration the short one would sprint.
 *
 * 30 is deliberately below the logos row's 40: that marquee is a thin band of
 * wordmarks glanced at in passing, this is a wall of work someone is reading.
 * A tile takes ~13s to cross a 400px-tall window, which is browsing pace.
 */
export const DRIFT_SPEED = 30;

/**
 * Per-column drift: which way it goes, and how fast.
 *
 * Direction alternates (D3) — that opposition is what stops the wall reading as
 * one sheet sliding past. Speed varies ±15% on a fixed pattern rather than at
 * random: `Math.random()` is banned in anything that renders (it would differ
 * between the server and the client), and a deterministic offset is also
 * reproducible when something looks wrong. The pattern is intentionally not
 * symmetric across 4 columns, so columns 1 and 3 (same direction) still drift
 * apart over time instead of moving as a pair.
 */
const SPEED_VARIANCE = [1, 0.87, 1.12, 0.94];

export function columnDrift(index: number): {
  direction: 1 | -1;
  speed: number;
} {
  return {
    // Even columns fall, odd columns rise.
    direction: index % 2 === 0 ? 1 : -1,
    speed: DRIFT_SPEED * SPEED_VARIANCE[index % SPEED_VARIANCE.length],
  };
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

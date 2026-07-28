/**
 * CloudCanvas project registry — the single place you author the portfolio set.
 *
 * Each entry is one project tile on the globe. You control, per project:
 *   • `form` — which tile slot it renders in (landscape / square / portrait).
 *     Honoured when the config's layout is "manual" (the shipped portfolio
 *     preset). Images are cover-cropped into the slot, so any form works for
 *     any image — pick whatever frames the shot best.
 *   • `type` — which filter tab it belongs to (web / branding / misc). The
 *     section's tabs filter the globe by this; "all" shows everything.
 *   • `name` — shown in the focus/hover label (added in a later pass).
 *
 * The images live in public/portfolio/cloud/ (≤900px WebP — 520 was tried and
 * was too low; the arithmetic is in scripts/optimize-portfolio-images.mjs. Run
 * `npm run optimize:portfolio` after dropping new ones in). Keep filenames
 * URL-clean (no spaces). Order here is the order tiles are laid onto the
 * formation — reorder entries to reshuffle neighbours.
 *
 * The uncropped Figma exports these were made from live in portfolio-src/ (repo
 * root, deliberately OUTSIDE public/ so they are never served); the Figma node
 * IDs are recorded in portfolio-src/SOURCES.md so any frame can be re-pulled.
 *
 * Every entry is real work now — the Figma "Startup" collage placeholders that
 * seeded this file are gone, and the set comes from the Figma "Design shortlist"
 * (webdesigns / BrandingTiles / Mics). portfolio-src/SOURCES.md maps every slug
 * back to its node ID.
 */

export type ProjectType = "web" | "branding" | "misc";
export type ProjectForm = "landscape" | "square" | "portrait";
/**
 * The shapes the WALL can draw — the globe's three, plus `tall` (D8/D11).
 *
 * A separate type rather than a fourth `ProjectForm`, and this is the load-
 * bearing part: `ProjectForm` is coupled to `SLOT_SIZE` in
 * cloud-canvas-engine.ts, so widening it would give the SPHERE a tall slot too
 * — a 1:1.67 card on a Fibonacci sphere, which is not what D8 asked for and
 * would reshape a tuned formation as a side effect of a wall change.
 *
 * So a full-length design carries a normal `form` for the globe (the sphere
 * cover-crops it like anything else) and `grid.form: "tall"` for the wall.
 * The two modes disagree about that project's shape ON PURPOSE.
 */
export type GridForm = ProjectForm | "tall";
/** A filter tab value: a project type, or "all" (the default tab). */
export type CloudFilter = ProjectType | "all";

export interface CloudProject {
  src: string;
  /** Shown in the focus/hover label (added in a later pass). */
  name: string;
  /** Filter-tab bucket. */
  type: ProjectType;
  /** Tile slot shape — used when the config's layout is "manual". */
  form: ProjectForm;
  /**
   * Grid-mode overrides — how the masonry wall is allowed to diverge from the
   * globe (docs/portfolio-grid-mode.md §9). **Nothing reads this yet**: it
   * lands empty, absent on all 24 entries, so the deferred full-length work
   * (D8, built last) becomes a field to fill in rather than a type change that
   * touches every consumer of CloudProject.
   *
   * A separate block instead of overloading the fields above, because the
   * top-level `form` is coupled to SLOT_SIZE in cloud-canvas-engine.ts AND to
   * SLOT_ASPECT in scripts/optimize-portfolio-images.mjs — reshaping a tile for
   * the wall by editing it would silently re-crop that same tile on the sphere.
   *
   * The case it exists for (§8.2): `brandings` is six projects and nearly all
   * portrait, so its wall is two columns of one repeating silhouette. Reshaping
   * a couple of them is the second lever after dropping columns, and it must
   * not disturb the slot they hold on the globe.
   */
  grid?: {
    /**
     * Slot shape for the wall only; falls back to the top-level `form`.
     *
     * `tall` (D8) lives here and NOWHERE else — see `GridForm` for why the
     * globe must not learn about it. A project using it still needs a sane
     * top-level `form` for the sphere.
     */
    form?: GridForm;
    /**
     * A different file for the wall, for when the globe's crop is the wrong
     * framing at wall size. Those belong under `public/portfolio/grid/` as
     * their own output preset, never as a re-tune of MAX_SIDE in
     * scripts/optimize-portfolio-images.mjs — that constant is hand-coupled to
     * the engine's FAST_MAX_SIDE, and raising it bills every globe visitor for
     * bytes they never see.
     *
     * ⚠️ OPTIONAL, AND NORMALLY ABSENT. `gridSrc()` below derives the wall's
     * file from `src` by convention, because scripts/build-portfolio-presets.mjs
     * emits one preset per project under the same slug — 24 hand-copied paths
     * would be 24 chances to typo a filename that still type-checks. Set this
     * only to point a tile at a file the convention would not find.
     */
    src?: string;
    /**
     * Likewise for the UNCROPPED shot the expand reveals (§15.3): the wall shows
     * the slot crop, opening a tile shows the whole design. Derived by
     * `fullSrc()` from `src`; set only to override.
     */
    full?: string;
    /**
     * Columns spanned. Reserved for D8; unused today. Every tile being span 1
     * is what lets the wall ship ONE `sizes` value per breakpoint (§8.1), so
     * the first span-2 tile also buys a second image preset — part of why it
     * is last.
     */
    span?: 1 | 2;
  };
}

/** The filter tabs, in display order. Labels are UI copy (house lowercase). */
export const PROJECT_FILTERS: { value: CloudFilter; label: string }[] = [
  { value: "all", label: "all" },
  { value: "web", label: "web designs" },
  { value: "branding", label: "brandings" },
  { value: "misc", label: "misc" },
];

const dir = "/portfolio/cloud";

/**
 * The wall's two image presets, both emitted by
 * scripts/build-portfolio-presets.mjs from the uncropped exports in
 * `portfolio-src/` (see that file's header for why they are built from the
 * originals and not from `dir` above).
 *
 *   grid  — cropped to the tile's SLOT aspect before the size cap, so the wall
 *           is not cropping an image that was already downscaled. Recovers the
 *           resolution §18.2 measured as lost: the worst tile goes 0.68× → 0.78×
 *           of the raster a 380px column needs at 2×, and the 16:9 web shots go
 *           1.05× → 1.18×.
 *   full  — UNCROPPED, for the expanded panel, which shows the whole design
 *           rather than the wall's crop (§15.3).
 *
 * The globe keeps reading `src` (`/portfolio/cloud`) and is untouched by both.
 */
const gridDir = "/portfolio/grid";
const fullDir = "/portfolio/full";

/**
 * Resolve a project's wall/expand file.
 *
 * Derived from `src` by slug rather than listed per entry: the preset script
 * emits exactly one file per project under the same name, so the mapping is
 * mechanical, and 24 literal paths in the registry would be 24 chances to point
 * at a file that does not exist — a typo that still type-checks and only shows
 * up as a broken tile. `grid.src` / `grid.full` remain as explicit overrides for
 * the case the convention cannot express.
 */
function preset(project: CloudProject, into: string): string {
  const slug = project.src.slice(project.src.lastIndexOf("/") + 1);
  return `${into}/${slug}`;
}

/** The tile as the WALL draws it — slot-cropped. */
export function gridSrc(project: CloudProject): string {
  return project.grid?.src ?? preset(project, gridDir);
}

/** The whole design, for the expanded panel — uncropped. */
export function fullSrc(project: CloudProject): string {
  return project.grid?.full ?? preset(project, fullDir);
}

// Entries rotate web → branding → misc rather than sitting in per-type blocks:
// registry order IS formation order, so a contiguous run would clump one type
// (and one tile shape) on a single face of the globe.
//
// Physical-object mockups file under `misc`, not under the discipline they
// present — a keycap render or a cloth tag is a photograph OF branding, not the
// branding itself, and they read as scene renders next to flat artwork.
export const cloudProjects: CloudProject[] = [
  { src: `${dir}/tasktrox-landing.webp`, name: "Tasktrox", type: "web", form: "landscape" },
  { src: `${dir}/emerald-mark.webp`, name: "Emerald Psychiatry", type: "branding", form: "portrait" },
  { src: `${dir}/cloth-tag-mockup.webp`, name: "cloth tag mockup", type: "misc", form: "square" },
  { src: `${dir}/kalinka.webp`, name: "Kalinka", type: "web", form: "landscape" },
  { src: `${dir}/emerald-poster-mind.webp`, name: "Emerald Psychiatry — your mind matters", type: "branding", form: "portrait" },
  // The THIRD full-length design (D8) — 1440×14730, an aspect of 0.0978 and the
  // longest thing in the set by some way. Same treatment as the two below it;
  // §29.1 is the argument for why a page this long still costs the wall nothing.
  //
  // This slot was CHOSEN, not guessed: of the four rotation-legal positions,
  // only this one and index 8 keep every desktop column down to one tall tile,
  // and this one balances the `all` wall tighter (0.43u of spread against
  // 0.63u). Re-run the check in §29.4 before moving it.
  { src: `${dir}/opus-ventures.webp`, name: "Opus Ventures", type: "web", form: "portrait", grid: { form: "tall" } },
  { src: `${dir}/desktop-mockup.webp`, name: "desktop mockup", type: "misc", form: "landscape" },
  { src: `${dir}/medlink.webp`, name: "Medlink", type: "web", form: "landscape" },
  // Pre-cropped by scripts/optimize-portfolio-images.mjs (CROPS), not centred:
  // a centred cut into the portrait slot bisects the emerald wordmark.
  { src: `${dir}/emerald-poster-help.webp`, name: "Emerald Psychiatry — ask for help", type: "branding", form: "portrait" },
  { src: `${dir}/phone-mockup-finance.webp`, name: "phone mockup — finance", type: "misc", form: "portrait" },
  { src: `${dir}/crypkit.webp`, name: "CrypKit", type: "web", form: "landscape" },
  { src: `${dir}/elyv-logo.webp`, name: "ElyV", type: "branding", form: "square" },
  // The SECOND full-length design (D8) — 1440×8780, an aspect of 0.164, and
  // the most extreme in the set: 1.8× longer than TroxRide and 3.6× taller than
  // the 0.6 slot it is cropped into. Same two-modes-disagree treatment; see the
  // TroxRide entry below for the full reasoning, which this one only repeats.
  //
  // Placed after a branding and before a misc so the rotation holds, and well
  // away from TroxRide in the `web` sequence — the wall's `web` filter drops
  // every branding and misc entry, so those two are what actually neighbour
  // each other there, and two 0.6 tiles dealt into the same column would give
  // that column a visible seam of full-length pages.
  //
  // Not adjacent to the four `emerald-*` BRANDING tiles either: this is the
  // same client's landing page, and stacking five Emerald entries in a row
  // would read as the sphere repeating itself.
  { src: `${dir}/emerald-landing.webp`, name: "Emerald Psychiatry — landing page", type: "web", form: "portrait", grid: { form: "tall" } },
  { src: `${dir}/tablet-mockup.webp`, name: "tablet mockup", type: "misc", form: "square" },
  { src: `${dir}/dubai-blueprint.webp`, name: "Dubai Blueprint", type: "web", form: "landscape" },
  { src: `${dir}/emerald-poster-ohio.webp`, name: "Emerald Psychiatry — telehealth", type: "branding", form: "portrait" },
  { src: `${dir}/laptop-mockup.webp`, name: "laptop mockup", type: "misc", form: "portrait" },
  { src: `${dir}/tasktrox-webapp.webp`, name: "Tasktrox — web app", type: "web", form: "landscape" },
  { src: `${dir}/circle-mark.webp`, name: "circle mark", type: "branding", form: "square" },
  // THE FIRST FULL-LENGTH DESIGN (D8) — 1440×4816, an aspect of 0.299.
  //
  // The two modes disagree about its shape on purpose. `form: "portrait"` is
  // for the GLOBE, which has no tall slot and must not grow one (see
  // `GridForm`); its cloud asset is cropped from the TOP by the CROPS entry in
  // optimize-portfolio-images.mjs, so the sphere shows the hero rather than a
  // centred slice of the testimonials. `grid.form: "tall"` gives the WALL its
  // 0.6 slot — and 0.6 is a cap, not the real aspect: see GRID_ASPECT.tall for
  // why a 0.299 tile would be taller than the wall it travels through.
  //
  // The whole 4816px page lives in the expand, which scrolls (§15.3, §24).
  // Placed between a branding and a misc entry so the added `web` does not
  // extend the run of them at the end of this list.
  { src: `${dir}/troxride-landing.webp`, name: "TroxRide", type: "web", form: "portrait", grid: { form: "tall" } },
  // 4:3 source, PORTRAIT slot — the frame is landscape but its subject is a
  // vertical phone on black, so the landscape slot would spend half the tile on
  // empty background. Cropping to portrait fills it with the device.
  { src: `${dir}/phone-mockup-fitness.webp`, name: "phone mockup — fitness", type: "misc", form: "portrait" },
  { src: `${dir}/operations-dashboard.webp`, name: "operations dashboard", type: "web", form: "landscape" },
  // `square` (not landscape) on purpose: the 4:3 source centre-crops to 1:1
  // around the monitor and drops the empty studio floor, which frames it
  // tighter AND breaks up an otherwise all-landscape web set.
  { src: `${dir}/monitor-mockup.webp`, name: "monitor mockup", type: "misc", form: "square" },
  { src: `${dir}/crypto-scratchers.webp`, name: "crypto scratchers", type: "web", form: "landscape" },
  { src: `${dir}/keycap-mockup.webp`, name: "keycap mockup", type: "misc", form: "landscape" },
  { src: `${dir}/performance-consultancy.webp`, name: "performance consultancy", type: "web", form: "landscape" },
  { src: `${dir}/fashion-storefront.webp`, name: "fashion storefront", type: "web", form: "landscape" },
];

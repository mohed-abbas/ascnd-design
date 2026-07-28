/**
 * Build the portfolio WALL's two image presets from the uncropped Figma exports.
 *
 *   npm run presets:portfolio          # write public/portfolio/{grid,full}
 *   npm run presets:portfolio -- --dry # report only, touch nothing
 *
 * This is the sibling of optimize-portfolio-images.mjs, NOT a replacement.
 * That script feeds the GLOBE and rewrites `public/portfolio/cloud` in place at
 * MAX_SIDE, a constant hand-coupled to the engine's FAST_MAX_SIDE. This one
 * never touches that directory or that constant — raising MAX_SIDE would bill
 * every globe visitor for bytes only the wall can see
 * (docs/portfolio-grid-mode.md §9, §20).
 *
 * ── WHY IT READS THE ORIGINALS ──────────────────────────────────────────────
 * The wall cover-crops each tile to its slot aspect at DRAW time (`object-cover`
 * in portfolio-grid.tsx). Cropping a source that has ALREADY been capped at 900
 * throws away resolution twice: §18.2 measured 8 of 24 tiles as source-limited
 * at a 380px column on a 2× display, worst `phone-mockup-fitness` at 0.68× of
 * the 760px raster it needs. Cropping to the wall aspect FIRST and capping
 * after is what buys that back. It cannot be done from `public/portfolio/cloud`
 * — only from the uncropped exports in `portfolio-src/`.
 *
 * ⚠️ `portfolio-src/` IS GITIGNORED. The PNGs are local-only, so this script
 * runs on a machine that has them; its OUTPUT is what gets committed. If the
 * folder is missing, re-pull the frames from Figma — file key and every node ID
 * are in `portfolio-src/SOURCES.md`.
 *
 * ── THE TWO PRESETS ─────────────────────────────────────────────────────────
 *   public/portfolio/grid/  cropped to the WALL aspect, long side ≤ GRID_MAX
 *                           → the tile in the column (grid.src)
 *   public/portfolio/full/  UNCROPPED, long side ≤ FULL_MAX
 *                           → the expanded panel (grid.full), which reveals the
 *                             whole design rather than the wall's crop
 *
 * Both inherit the immutable cache headers already set on `/portfolio/:path*`
 * in next.config.ts, so neither subdirectory needs a config change.
 *
 * The wall aspect per slug is PARSED out of cloud-canvas-data.ts rather than
 * duplicated here. That registry is the single source of truth for `form` (and
 * for `grid.form`, which overrides it for the wall only); a copy in this file
 * would drift silently the first time a tile is reshaped. A slug the registry
 * doesn't mention, or a source file that is missing, is a hard error — never a
 * skipped tile that quietly ships at the wrong crop.
 */
import { readdir, stat, mkdir, rename } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC_ROOT = "portfolio-src";
const GRID_DIR = "public/portfolio/grid";
const FULL_DIR = "public/portfolio/full";
const REGISTRY = "components/sections/portfolio/cloud-canvas/cloud-canvas-data.ts";

/**
 * Wall tile cap. A column is capped at 380 CSS px (portfolio-grid.tsx
 * `max-w-[380px]`), so 760 covers a 2× display exactly. 900 leaves headroom for
 * a future wider column without another re-encode, and matches the number the
 * globe already ships so neither preset looks sharper than the other in the
 * split second the mode switches.
 */
const GRID_MAX = 900;
/**
 * Expanded-panel cap. The panel is `min(86vw, …)`, so ~1300 CSS px on a 1512
 * screen. These exports top out at 1366 on the long side anyway (SOURCES.md),
 * so this is "native, re-encoded" for nearly every tile — it exists to bound
 * anything larger dropped in later, not to upscale.
 */
const FULL_MAX = 1400;
const QUALITY = 82;

const INPUT_RE = /\.(png|jpe?g|webp|avif)$/i;

/**
 * Wall aspects — MUST match GRID_ASPECT in grid/grid-spec.ts.
 *
 * The first three mirror SLOT_SIZE in cloud-canvas-engine.ts and move with it.
 * `tall` (D8) is the wall's ALONE — the globe has no such slot and must not
 * grow one; see the `GridForm` note in cloud-canvas-data.ts. A project using it
 * still carries a normal `form` for the sphere, and this script crops it twice,
 * differently, on purpose.
 */
const GRID_ASPECT = {
  landscape: 164 / 104,
  square: 1,
  portrait: 112 / 146,
  tall: 0.6,
};

/**
 * Forms whose crop keeps the TOP of the source rather than its centre.
 *
 * A full-length page is identified by its hero — the logo, the headline, the
 * first image. A centred cut into a 0.6 slot on a 4816px-tall page lands
 * somewhere around the testimonials and could belong to any site. This also
 * makes the expand's stage 1 exact: the panel opens top-anchored, so the
 * uncropped design's first screenful IS the tile the visitor clicked.
 */
const TOP_ANCHORED = new Set(["tall"]);

/**
 * Off-centre crop focus, by slug. Only for images where a CENTRED cut is the
 * wrong one — the single thing `object-cover` cannot express at runtime.
 * 0 keeps the top/left edge, 1 the bottom/right, 0.5 is centred.
 *
 * Kept in step with the CROPS map in optimize-portfolio-images.mjs: the same
 * image cropped for the globe and for the wall should lose the same edge.
 */
const FOCUS = {
  // 2:3 poster into the 0.767 portrait slot loses 13% of its height; centred
  // slices the emerald wordmark along the bottom. 0.85 takes the loss off the
  // top instead — full lockup and URL survive.
  "emerald-poster-help": 0.85,
};

const dry = process.argv.includes("--dry");
const kb = (n) => `${Math.round(n / 1024)}KB`;

/**
 * Pull `{ slug → wall form }` out of the TS registry.
 *
 * Brace-balanced rather than line-based: an entry that grows a `grid: { … }`
 * block is still one entry, and `grid.form` (the wall's override) has to win
 * over the top-level `form` (the globe's slot) when both are present.
 */
async function readRegistry() {
  const source = await readFile(REGISTRY, "utf8");
  const start = source.indexOf("export const cloudProjects");
  if (start === -1) throw new Error(`cloudProjects not found in ${REGISTRY}`);

  const entries = new Map();
  // Walk brace-balanced object literals from the start of the array. Anchor on
  // the `= [` and not on the first `[`, which belongs to the `CloudProject[]`
  // type annotation and would end the walk before it began.
  const opens = source.indexOf("= [", start);
  if (opens === -1) throw new Error(`cloudProjects array not found in ${REGISTRY}`);
  let i = opens + 2;
  let depth = 0;
  let from = -1;
  for (; i < source.length; i++) {
    const c = source[i];
    if (c === "{") {
      if (depth === 0) from = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && from !== -1) {
        const chunk = source.slice(from, i + 1);
        const slug = chunk.match(/\$\{dir\}\/([\w-]+)\.\w+/)?.[1];
        if (slug) {
          const gridBlock = chunk.match(/grid:\s*\{([\s\S]*?)\}/)?.[1] ?? "";
          const wallForm =
            gridBlock.match(/form:\s*"(\w+)"/)?.[1] ??
            chunk.match(/form:\s*"(\w+)"/)?.[1];
          if (!wallForm) throw new Error(`no form for "${slug}" in ${REGISTRY}`);
          if (!(wallForm in GRID_ASPECT))
            throw new Error(`unknown form "${wallForm}" for "${slug}"`);
          entries.set(slug, wallForm);
        }
        from = -1;
      }
    } else if (c === "]" && depth === 0) break;
  }
  if (entries.size === 0) throw new Error(`parsed 0 projects from ${REGISTRY}`);
  return entries;
}

/** Index every original by slug, so the type subfolder doesn't have to be known. */
async function indexSources() {
  const found = new Map();
  for (const group of await readdir(SRC_ROOT, { withFileTypes: true })) {
    if (!group.isDirectory()) continue;
    const groupDir = path.join(SRC_ROOT, group.name);
    for (const file of await readdir(groupDir)) {
      if (!INPUT_RE.test(file)) continue;
      found.set(file.replace(INPUT_RE, ""), path.join(groupDir, file));
    }
  }
  return found;
}

/**
 * Crop box that cuts `meta` down to `target` aspect, or null when it already
 * matches within a pixel. Trims only the axis that is too long, so nothing is
 * ever letterboxed — the same centre-crop `object-cover` performs, just done
 * once at build time and at full source resolution.
 */
function cropBox(target, meta, focus = 0.5) {
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) return null;
  if (w / h > target) {
    const cw = Math.round(h * target);
    if (cw >= w) return null;
    return { left: Math.round((w - cw) * focus), top: 0, width: cw, height: h };
  }
  const ch = Math.round(w / target);
  if (ch >= h) return null;
  return { left: 0, top: Math.round((h - ch) * focus), width: w, height: ch };
}

/**
 * The cap is on WIDTH, not on the longer side.
 *
 * Width is the axis the layout actually constrains — a column is 380px, a panel
 * is 86vw — and the axis `sizes` describes, so it is the one that decides
 * whether a tile looks sharp. Capping the longer side instead breaks down the
 * moment an image is TALLER than it is wide: a 1440×4816 landing page capped at
 * 1400 on its long side comes out 418px across, which is narrower than the
 * column it has to fill.
 *
 * For every non-tall tile the two rules agree exactly — after cropping, none of
 * them is tall enough for height to bind first — so this is a no-op on the
 * existing set and the correct rule for the ones arriving.
 */
async function emit({ file, out, crop, cap }) {
  if (dry) return null;
  const tmp = `${out}.tmp`; // sharp cannot read and write the same path
  let pipeline = sharp(file);
  if (crop) pipeline = pipeline.extract(crop);
  await pipeline
    // withoutEnlargement: a source already under the cap keeps its pixels. This
    // pass may only ever REMOVE detail, never invent it. Height is omitted, so
    // sharp scales it proportionally.
    .resize({ width: cap, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(tmp);
  await rename(tmp, out);
  return (await stat(out)).size;
}

// ── run ──────────────────────────────────────────────────────────────────────
const registry = await readRegistry();
const sources = await indexSources();

const missing = [...registry.keys()].filter((slug) => !sources.has(slug));
if (missing.length) {
  console.error(
    `Missing originals in ${SRC_ROOT}/ for: ${missing.join(", ")}\n` +
      `Re-pull them from Figma — node IDs are in ${SRC_ROOT}/SOURCES.md.`,
  );
  process.exit(1);
}

if (!dry) {
  await mkdir(GRID_DIR, { recursive: true });
  await mkdir(FULL_DIR, { recursive: true });
}

let gridBytes = 0;
let fullBytes = 0;
const report = [];

for (const [slug, form] of [...registry].sort()) {
  const file = sources.get(slug);
  const meta = await sharp(file).metadata();
  const aspect = GRID_ASPECT[form];
  const focus = FOCUS[slug] ?? (TOP_ANCHORED.has(form) ? 0 : 0.5);
  const crop = cropBox(aspect, meta, focus);

  const gridOut = path.join(GRID_DIR, `${slug}.webp`);
  const fullOut = path.join(FULL_DIR, `${slug}.webp`);

  const g = await emit({ file, out: gridOut, crop, cap: GRID_MAX });
  const f = await emit({ file, out: fullOut, crop: null, cap: FULL_MAX });
  gridBytes += g ?? 0;
  fullBytes += f ?? 0;

  // What the wall actually gets to draw with, vs the 760px raster a 380px
  // column needs on a 2× display. <1.0 means the tile is still source-limited.
  const cropped = crop ?? { width: meta.width, height: meta.height };
  const scale = Math.min(1, GRID_MAX / cropped.width);
  const usable = Math.round(cropped.width * scale);
  report.push({
    slug,
    form,
    src: `${meta.width}x${meta.height}`,
    grid: `${usable}x${Math.round(cropped.height * scale)}`,
    headroom: (usable / 760).toFixed(2),
    fullAspect: +(meta.width / meta.height).toFixed(4),
  });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(
  `${pad("slug", 26)}${pad("form", 11)}${pad("source", 12)}${pad("wall tile", 12)}headroom`,
);
for (const r of report) {
  console.log(
    `${pad(r.slug, 26)}${pad(r.form, 11)}${pad(r.src, 12)}${pad(r.grid, 12)}${r.headroom}×` +
      (Number(r.headroom) < 1 ? "  ← source-limited" : ""),
  );
}
console.log(
  `\n${report.length} tiles · grid ${kb(gridBytes)} · full ${kb(fullBytes)}`,
);
if (dry) console.log("(dry run — nothing written)");

// The registry needs `grid.src`, `grid.full` and `grid.fullAspect` per entry.
// Printed rather than written: this script does not edit the registry (the same
// rule optimize-portfolio-images.mjs follows), and fullAspect has to be baked in
// so the expand can size its panel before the image has loaded.
console.log("\n— grid block per project (paste into cloud-canvas-data.ts) —");
for (const r of report) {
  console.log(
    `  ${r.slug}: grid: { src: \`\${gridDir}/${r.slug}.webp\`, full: \`\${fullDir}/${r.slug}.webp\`, fullAspect: ${r.fullAspect} },`,
  );
}

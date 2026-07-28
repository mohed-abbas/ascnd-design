/**
 * Re-encode the portfolio globe's project stills to the size the engine actually
 * draws them at.
 *
 *   npm run optimize:portfolio          # rewrite public/portfolio/cloud in place
 *   npm run optimize:portfolio -- --dry # report only, touch nothing
 *
 * WHY: cloud-canvas-engine.ts downscales every source into an offscreen canvas
 * at FAST_MAX_SIDE on the way in (loadFastImage), so anything larger than that
 * is bytes downloaded, decoded, and then thrown away on every cold visit. The
 * originals were 900px+ on the long side — measured 1478KB across 28 files, all
 * 28 oversized — which on Fast 3G left the section as empty sky for seconds.
 *
 * ⚠️ MAX_SIDE below is coupled to FAST_MAX_SIDE in cloud-canvas-engine.ts. They
 * must move together: raising the engine constant without re-running this script
 * means it upscales these files and the globe goes soft.
 *
 * It was briefly 520, which was too low — see the FAST_MAX_SIDE comment for the
 * arithmetic. A tile is drawn at up to ~2.6× its authored slot px, so 520 made a
 * focused tile a 1.4× upscale and turned UI screenshots to mush.
 *
 * RUN THIS WHENEVER THE PROJECT IMAGES CHANGE. It is idempotent (already-sized
 * files are skipped) and format-agnostic: drop in .jpg/.png/.webp/.avif named
 * cloud-NN.* and it normalises everything to cloud-NN.webp, removing the
 * non-webp original so the paths in cloud-canvas-data.ts keep resolving. It does
 * NOT touch that registry — a NEW filename still needs its entry there (src,
 * name, type, and `form`, which is what decides the tile's slot shape and is
 * read before the image loads).
 */
import { readdir, stat, rename, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DIR = "public/portfolio/cloud";
const MAX_SIDE = 900; // === FAST_MAX_SIDE (cloud-canvas-engine.ts)
const QUALITY = 82; // webp; these are heavily downscaled already, so this is
// visually transparent at the size the globe draws them
const INPUT_RE = /\.(webp|jpe?g|png|avif)$/i;

/** Slot aspect ratios — must match SLOT_SIZE in cloud-canvas-engine.ts. */
const SLOT_ASPECT = { landscape: 164 / 104, square: 1, portrait: 112 / 146 };

/**
 * Per-image crop overrides. Listed files are cut to their slot's aspect HERE,
 * before shipping; everything else is left alone.
 *
 * Most images need no entry: the engine cover-crops from the CENTRE at draw
 * time (drawImageCover), so a centred cut costs nothing to leave until runtime.
 * This map is only for the images where centre is the wrong cut — an off-centre
 * `focus` is the one thing runtime cropping cannot express.
 *
 * `focus` slides the crop window along whichever axis gets trimmed:
 *   0 = keep the top/left edge, 1 = keep the bottom/right edge, 0.5 = centred.
 */
const CROPS = {
  // 2:3 poster into the 0.767 portrait slot loses 13% of its height, and a
  // centred cut slices the emerald wordmark in half along the bottom edge.
  // 0.85 takes that loss off the top instead: full lockup and URL survive, the
  // orange arc still reads, and no one's head gets cropped.
  "emerald-poster-help": { form: "portrait", focus: 0.85 },
  // A 1440×4816 full-length landing page (0.299) in the portrait slot. A
  // centred cut keeps 1878px out of 4816 — a band somewhere around the
  // testimonials that could belong to any site. focus 0 keeps the TOP, so the
  // sphere shows the hero and the tile is recognisably TroxRide.
  //
  // The WALL crops the same source differently again (0.6, also top-anchored)
  // via scripts/build-portfolio-presets.mjs — see the `GridForm` note in
  // cloud-canvas-data.ts for why the two modes are allowed to disagree.
  "troxride-landing": { form: "portrait", focus: 0 },
  // Same treatment, more extreme: 1440×8780 (0.164). A centred cut keeps 1878px
  // out of 8780 — here that lands in the FAQ accordion, which is the least
  // identifying band on the page. focus 0 keeps the top, so the sphere shows
  // the emerald wordmark and the "Care that works" hero.
  "emerald-landing": { form: "portrait", focus: 0 },
  // 1440×14730 (0.0978), the longest of the three. A centred cut keeps 1878px
  // out of 14730 — 13% of the page, taken from somewhere around the accreditation
  // logos. focus 0 keeps the top: the "opus." wordmark and the "a symphony of
  // wealth" hero, which is the only band that identifies the fund.
  "opus-ventures": { form: "portrait", focus: 0 },
};

const dry = process.argv.includes("--dry");
const kb = (n) => `${Math.round(n / 1024)}KB`;

const files = (await readdir(DIR)).filter((f) => INPUT_RE.test(f)).sort();
if (files.length === 0) {
  console.error(`No images found in ${DIR}`);
  process.exit(1);
}

/**
 * Resolve a CROPS entry into a sharp extract() box, or null when the image is
 * already at (or within a pixel of) its slot aspect and nothing needs cutting.
 */
function cropBox(spec, meta) {
  if (!spec) return null;
  const target = SLOT_ASPECT[spec.form];
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!target || !w || !h) return null;
  const focus = spec.focus ?? 0.5;
  if (w / h > target) {
    const cw = Math.round(h * target);
    if (cw >= w) return null;
    return { left: Math.round((w - cw) * focus), top: 0, width: cw, height: h };
  }
  const ch = Math.round(w / target);
  if (ch >= h) return null;
  return { left: 0, top: Math.round((h - ch) * focus), width: w, height: ch };
}

let before = 0;
let after = 0;
let rewritten = 0;
let skipped = 0;

for (const file of files) {
  const src = path.join(DIR, file);
  const size = (await stat(src)).size;
  before += size;

  const meta = await sharp(src).metadata();
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  const isWebp = /\.webp$/i.test(file);

  // Already at target and already webp → leave it alone, so re-running after a
  // partial image swap only pays for the new files.
  if (isWebp && longest <= MAX_SIDE) {
    after += size;
    skipped++;
    continue;
  }

  const out = path.join(DIR, file.replace(INPUT_RE, ".webp"));
  const tmp = `${out}.tmp`; // sharp can't read and write the same path
  const crop = cropBox(CROPS[file.replace(INPUT_RE, "")], meta);

  if (dry) {
    const how = crop ? ` crop→${crop.width}x${crop.height}` : "";
    console.log(`would rewrite ${file}  ${meta.width}x${meta.height}${how}  ${kb(size)}`);
    after += size;
    rewritten++;
    continue;
  }

  let pipeline = sharp(src);
  if (crop) pipeline = pipeline.extract(crop);
  await pipeline
    // withoutEnlargement: a source already under MAX_SIDE keeps its pixels;
    // this pass is only ever allowed to remove detail the engine discards.
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(tmp);

  if (!isWebp) await unlink(src); // normalise the extension to .webp
  await rename(tmp, out);

  const newSize = (await stat(out)).size;
  after += newSize;
  rewritten++;
  console.log(
    `${file} → ${path.basename(out)}  ${meta.width}x${meta.height} → ≤${MAX_SIDE}  ${kb(size)} → ${kb(newSize)}`,
  );
}

console.log(
  `\n${rewritten} rewritten, ${skipped} already optimal — ${kb(before)} → ${kb(after)}` +
    (before > 0 ? `  (−${Math.round((1 - after / before) * 100)}%)` : ""),
);
if (dry) console.log("(dry run — nothing written)");

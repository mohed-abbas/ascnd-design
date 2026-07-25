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
const MAX_SIDE = 520; // === FAST_MAX_SIDE (cloud-canvas-engine.ts)
const QUALITY = 82; // webp; these are heavily downscaled already, so this is
// visually transparent at the size the globe draws them
const INPUT_RE = /\.(webp|jpe?g|png|avif)$/i;

const dry = process.argv.includes("--dry");
const kb = (n) => `${Math.round(n / 1024)}KB`;

const files = (await readdir(DIR)).filter((f) => INPUT_RE.test(f)).sort();
if (files.length === 0) {
  console.error(`No images found in ${DIR}`);
  process.exit(1);
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

  if (dry) {
    console.log(`would rewrite ${file}  ${meta.width}x${meta.height}  ${kb(size)}`);
    after += size;
    rewritten++;
    continue;
  }

  await sharp(src)
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

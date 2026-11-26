#!/usr/bin/env node
/**
 * Runs right after `next build` (package.json "build"): uploads the browser
 * source maps to GlitchTip, then DELETES every public .map file.
 *
 * Why: next.config.ts turns on `productionBrowserSourceMaps`, and this script
 * stamps each chunk in .next/static and its .map with a matching debug ID
 * (sentry-cli inject). GlitchTip uses that ID to turn a minified frame
 * (chunk.js:1:48213) back into the real file and line — but only if it has
 * the map. The maps must never ship: Next would serve them publicly
 * and hand our original source to anyone who asks. Vercel packages .next only
 * after this script exits, so deleting here keeps them out of the deployment.
 *
 * Upload needs a GlitchTip auth token in SENTRY_AUTH_TOKEN (set in Vercel's
 * environment variables, never committed). Without it — local builds, forks —
 * the upload is skipped, but the maps are still deleted. An upload FAILURE is
 * logged and ignored: a GlitchTip outage must never block a deploy.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const STATIC_DIR = ".next/static";
const GLITCHTIP_URL = "https://errors.thecodeman.cloud";
const GLITCHTIP_ORG = process.env.SENTRY_ORG ?? "eztech";
const GLITCHTIP_PROJECT = process.env.SENTRY_PROJECT ?? "ascnd";

function findMaps(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findMaps(path);
    return entry.name.endsWith(".map") ? [path] : [];
  });
}

function sentryCli(args) {
  return spawnSync("sentry-cli", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      SENTRY_URL: GLITCHTIP_URL,
      SENTRY_ORG: GLITCHTIP_ORG,
      SENTRY_PROJECT: GLITCHTIP_PROJECT,
    },
  }).status;
}

if (process.env.SENTRY_AUTH_TOKEN) {
  // 1. inject: give every chunk + its map a matching debug ID, and prepend a
  //    tiny snippet that registers it in globalThis._sentryDebugIds at runtime
  //    — that registration is what lets the SDK tell GlitchTip which map to
  //    use. (Turbopack's own `debugIds` option writes the comments but not the
  //    registration; see next.config.ts.) Only done when we can upload: a
  //    tokenless build ships chunks untouched.
  // 2. upload: send chunks + maps to GlitchTip as one artifact bundle.
  console.log(`[sourcemaps] uploading to ${GLITCHTIP_URL} (${GLITCHTIP_ORG}/${GLITCHTIP_PROJECT})`);
  const status =
    sentryCli(["sourcemaps", "inject", STATIC_DIR]) ||
    sentryCli(["sourcemaps", "upload", "--url-prefix", "~/_next/static", STATIC_DIR]);
  if (status !== 0) {
    console.warn("[sourcemaps] upload FAILED — deploying anyway; stack traces stay minified for this build.");
  }
} else {
  console.log("[sourcemaps] SENTRY_AUTH_TOKEN not set — skipping upload.");
}

const maps = findMaps(STATIC_DIR);
for (const map of maps) rmSync(map);
console.log(`[sourcemaps] removed ${maps.length} public .map files from ${STATIC_DIR}`);

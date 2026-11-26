#!/usr/bin/env node
/**
 * Runs right after `next build` (package.json "build"): uploads the browser
 * source maps to GlitchTip, then DELETES every public .map file.
 *
 * Why: next.config.ts turns on `productionBrowserSourceMaps` and
 * `turbopack.debugIds`, so each chunk in .next/static carries a
 * `//# debugId=…` comment matching its .map. GlitchTip uses that ID to turn a
 * minified frame (chunk.js:1:48213) back into the real file and line — but only
 * if it has the map. The maps must never ship: Next would serve them publicly
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

if (process.env.SENTRY_AUTH_TOKEN) {
  console.log(`[sourcemaps] uploading to ${GLITCHTIP_URL} (${GLITCHTIP_ORG}/${GLITCHTIP_PROJECT})`);
  const result = spawnSync(
    "sentry-cli",
    [
      "sourcemaps",
      "upload",
      "--url-prefix",
      "~/_next/static",
      STATIC_DIR,
    ],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        SENTRY_URL: GLITCHTIP_URL,
        SENTRY_ORG: GLITCHTIP_ORG,
        SENTRY_PROJECT: GLITCHTIP_PROJECT,
      },
    },
  );
  if (result.status !== 0) {
    console.warn("[sourcemaps] upload FAILED — deploying anyway; stack traces stay minified for this build.");
  }
} else {
  console.log("[sourcemaps] SENTRY_AUTH_TOKEN not set — skipping upload.");
}

const maps = findMaps(STATIC_DIR);
for (const map of maps) rmSync(map);
console.log(`[sourcemaps] removed ${maps.length} public .map files from ${STATIC_DIR}`);

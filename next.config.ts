import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this directory. Without it, Next.js infers the
  // root from the nearest lockfile up the tree and picks a stray empty
  // package-lock.json in the home directory. See turbopack docs: root must be
  // an absolute path.
  turbopack: {
    root: __dirname,
  },
  // Strict Mode double-mounts every component in dev. For the WebGL cloud
  // canvas that means create context → force-loss → recreate within ~100ms,
  // which made the clouds visibly flicker (mount/unmount/remount) on load.
  // Production never runs Strict Mode, so disabling it here makes dev match the
  // verified-clean production behavior. Re-add Strict Mode per-subtree with
  // <React.StrictMode> around non-WebGL trees if you want the dev checks back.
  reactStrictMode: false,
  // Serve AVIF (then WebP) for images that DO go through Next's optimizer — the
  // default is WebP-only. The hand-tuned rock cut-outs stay `unoptimized`
  // (pre-encoded AVIF), so this only affects other next/image usage (e.g. the
  // design-shot tiles). See docs/performance-audit.md A5.
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;

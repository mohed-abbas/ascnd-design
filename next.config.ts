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
  // Next serves /public with `Cache-Control: public, max-age=0, must-revalidate`,
  // which forces a 304 revalidation round-trip on EVERY use of a file — even a
  // cached one. For the testimonials rock GLB that round-trip lands on the
  // critical path when the canvas mounts at near-view (measured ~150ms just to
  // revalidate 0 bytes), so the rocks stall behind a network hop the preload was
  // meant to eliminate. Serve it `immutable` instead — like Next's own hashed
  // _next/static assets — so the browser reuses the preloaded bytes with zero
  // round-trip. Safe because the filename is version-suffixed (.vN.glb): bump
  // the version on any model change (see testimonial-rocks-canvas.tsx header).
  // Headers are matched before the /public filesystem (Next headers() docs).
  async headers() {
    // Every other /public asset keeps its default-cached bytes but pays a
    // 304 revalidation round-trip PER FILE on every visit (the same failure
    // mode as the GLB above — dozens of conditional requests contending with
    // the intro's critical path on each reload). These filenames are NOT
    // versioned, so `immutable` would pin a stale image forever after an
    // in-place swap; `stale-while-revalidate` instead serves from cache with
    // ZERO foreground requests and refreshes in the background — an in-place
    // asset swap propagates within a day. If an asset ever needs instant
    // propagation, version its filename and give it an `immutable` rule like
    // the GLB (which stays last so its stronger header wins over /rocks).
    const imageCache = {
      key: "Cache-Control",
      value: "public, max-age=86400, stale-while-revalidate=31536000",
    };
    const imageDirs = [
      "brand",
      "cards",
      "clouds",
      "fonts",
      "footer",
      "portfolio",
      "rocks",
      "shots",
      "textures",
    ];
    return [
      ...imageDirs.map((dir) => ({
        source: `/${dir}/:path*`,
        headers: [imageCache],
      })),
      {
        source: "/rocks/testimonial-rock.v1.glb",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

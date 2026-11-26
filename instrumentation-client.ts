/**
 * Browser error reporting → GlitchTip, self-hosted on our VPS
 * (errors.thecodeman.cloud). GlitchTip speaks the Sentry protocol, so this is
 * the stock Sentry SDK pointed at our own DSN. Next runs this file before the
 * app becomes interactive (instrumentation-client docs).
 *
 * @sentry/browser, NOT @sentry/nextjs: the Next wrapper bundles performance
 * tracing whether you use it or not — measured ~80 KB gzipped client-side vs
 * ~30 KB for the plain browser SDK. The wrapper's extras (server capture,
 * source-map upload) don't need its client bundle.
 *
 * Reports go through our own origin (`tunnel`), not to the VPS directly: the
 * /a/e rewrite in next.config.ts forwards them, so ad-blockers that drop
 * Sentry-shaped requests don't silently swallow our errors.
 *
 * Deliberately lean: errors only — no performance tracing, no session replay
 * (GlitchTip doesn't support replay, and both add weight and per-frame work to
 * a page whose budget goes to the sky and the rocks). `sendDefaultPii` stays at
 * its default (false), so no IPs or cookies are attached to events.
 *
 * Disabled outside production builds so `next dev` noise never reaches the
 * dashboard. Vercel previews DO report, tagged environment "preview".
 */
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "https://f8235cf93334482f81e7270e33479da4@errors.thecodeman.cloud/2",
  tunnel: "/a/e",
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "production",
  // Noise that isn't ours to fix: browser-extension scripts, and the benign
  // ResizeObserver warning Chrome raises when a layout settles over two frames.
  denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-extension:\/\//],
  ignoreErrors: ["ResizeObserver loop limit exceeded", "ResizeObserver loop completed with undelivered notifications"],
});

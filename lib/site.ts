/**
 * Site-wide constants for anything that needs to name or locate the site:
 * metadata in app/layout.tsx, app/robots.ts, app/sitemap.ts and the OG card.
 *
 * These lived as three separate literals before and drifted — a canonical URL
 * that disagreed with the sitemap's `loc` is the kind of thing nobody notices
 * until a crawler does. One module, imported by all of them.
 *
 * SITE_URL is the ORIGIN ONLY (no trailing slash) — `new URL()` in metadataBase
 * and the sitemap both append their own paths. It reads from
 * NEXT_PUBLIC_SITE_URL when set so preview deployments describe themselves
 * honestly, and falls back to production.
 *
 * Server-safe: pure data, no browser APIs.
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ascnd.design"
).replace(/\/$/, "");

export const SITE_NAME = "ascnd";

export const SITE_TAGLINE =
  "your design and front-end team without the hiring";

export const SITE_DESCRIPTION =
  "Subscribe and request unlimited brand, web, and product design. Delivered in days, shipped as real code.";

/**
 * Every indexable route, in nav order. The sitemap maps over this; adding a
 * route here is the ONLY step needed to get it crawled.
 */
export const SITE_ROUTES = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
] as const;

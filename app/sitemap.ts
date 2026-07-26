import type { MetadataRoute } from "next";
import { SITE_ROUTES, SITE_URL } from "@/lib/site";

/**
 * /sitemap.xml — one entry per route in lib/site.ts SITE_ROUTES.
 *
 * `lastModified` is stamped at BUILD time (module scope, evaluated once), not
 * per request: this is a static marketing site, so "when it was last deployed"
 * is exactly the truthful answer, and a per-request `new Date()` would opt the
 * route out of caching for no benefit.
 */
const BUILT_AT = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return SITE_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: BUILT_AT,
    changeFrequency,
    priority,
  }));
}

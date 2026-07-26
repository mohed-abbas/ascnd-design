import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * /robots.txt — generated, so the sitemap URL can never drift from the origin
 * the rest of the metadata uses (both read lib/site.ts).
 *
 * Everything is crawlable: this is a two-page marketing site with no private
 * routes left (the /lab sandboxes are gone from this branch entirely). Next's
 * own /_next/static assets are hashed and harmless to crawl.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

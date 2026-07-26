import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

/**
 * The social share card (also serves as the Twitter image — Next falls back to
 * opengraph-image when no twitter-image exists).
 *
 * Drawn rather than shipped as a file so it can't drift from the copy: the
 * wordmark, tagline and description all come from lib/site.ts, and the sky is
 * the day palette's real gradient stops (lib/theme/palette.ts PALETTES.day.sky
 * / globals.css --sky-*). Change the site's words or sky and the card follows.
 *
 * FONT: deliberately the renderer's default sans, NOT Product Sans. satori (what
 * ImageResponse renders with) supports ttf/otf/woff only, and the site's Product
 * Sans is woff2 — see app/fonts/. Drop a .ttf/.otf copy in and pass it via the
 * `fonts` option to put the real typeface on the card.
 */

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 88,
          // The day sky, top → horizon.
          backgroundImage:
            "linear-gradient(180deg, #4a9dff 0%, #62abff 55%, #9cc9ff 100%)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            fontSize: 150,
            fontWeight: 700,
            letterSpacing: -6,
            lineHeight: 1,
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            marginTop: 26,
            fontSize: 52,
            fontWeight: 500,
            letterSpacing: -1,
            lineHeight: 1.15,
            maxWidth: 900,
          }}
        >
          {SITE_TAGLINE}
        </div>
        <div
          style={{
            marginTop: 26,
            fontSize: 30,
            lineHeight: 1.35,
            maxWidth: 860,
            color: "rgba(255,255,255,0.82)",
          }}
        >
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    size,
  );
}

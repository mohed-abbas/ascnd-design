import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Serif } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Background from "@/components/background/background";
import CloudLayer from "@/components/background/cloud-layer";
import SharedCanvasHost from "@/components/canvas/shared-canvas-host";
import Cursor from "@/components/cursor/cursor";
import { FLAGS } from "@/lib/flags";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import LenisProvider from "@/components/providers/lenis-provider";
import QualityController from "@/components/providers/quality-controller";
import ThemeDriver from "@/components/providers/theme-driver";
import ModeSwitcher from "@/components/ui/mode-switcher";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Instrument Serif — used for the italic-feel "hiring" accent in the hero headline.
const instrumentSerif = Instrument_Serif({
  weight: "400",
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  display: "swap",
});

// Product Sans (proprietary) — self-hosted from app/fonts/. Exposes
// --font-product-sans, consumed by --font-product in globals.css.
const productSans = localFont({
  variable: "--font-product-sans",
  display: "swap",
  src: [
    { path: "./fonts/ProductSans-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/ProductSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ProductSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ProductSans-Bold.woff2", weight: "700", style: "normal" },
  ],
});

/**
 * Root metadata. `metadataBase` is what lets every route below express its
 * canonical/OG URLs as relative paths — without it, a relative URL in any
 * metadata field is a build error (Next metadata docs, "metadataBase").
 *
 * `title.template` means a child route sets only its own name ("pricing") and
 * gets "pricing — ascnd" for free; `title.default` covers routes that set none.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

/**
 * The sky is the brand — tint the mobile browser chrome to match it rather than
 * letting Safari/Chrome pick white and break the edge-to-edge sky. One entry per
 * scheme so the night sky doesn't get a bright chrome bar above it.
 *
 * themeColor lives on the `viewport` export, NOT `metadata` — Next moved it and
 * warns at build time if it's in the wrong one (generateViewport docs).
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#62abff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c3f6e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistMono.variable} ${productSans.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Warm the WebGL intro's Text3D font during HTML parse so it isn't a
            serial wait after the (lazy) intro chunk downloads — it gates the
            scene's ready signal. React 19 hoists this preload into <head>.
            crossOrigin must match the consumer or the preload is WASTED (audit
            H2: "credentials mode does not match" → double download): drei's
            useFont → THREE FileLoader fetches with mode "cors" / credentials
            "same-origin", which is exactly what crossOrigin="anonymous" makes
            this preload request.

            `media` is what keeps this off phones. The welcome scene is gated by
            intro-state.ts on `(max-width: 768px)` and `prefers-reduced-motion`,
            so on a phone nothing ever consumes this file and the preload was a
            pure wasted download plus an unused-preload console warning.

            It has to be an ATTRIBUTE rather than a runtime check because this is
            a Server Component: it cannot know the viewport, and moving the tag
            into a client component would push it past hydration and lose the
            head start this preload exists to buy. A media query on a preload is
            evaluated by the PRELOAD SCANNER during HTML parse — the browser
            simply never issues the request when it doesn't match — so desktop
            keeps the identical early fetch and mobile pays nothing. Keep this
            query in lockstep with intro-state.ts's SMALL_SCREEN/REDUCE_MOTION.
            (Its hasWebGL() gate has no media-query equivalent; a desktop with
            WebGL disabled still fetches this, as it did before.) */}
        <link
          rel="preload"
          href="/fonts/product-sans-medium.typeface.json"
          as="fetch"
          crossOrigin="anonymous"
          media="(min-width: 769px) and (prefers-reduced-motion: no-preference)"
        />
        {/* The bare cliff cut-outs are NOT hand-preloaded here anymore: the DOM
            <Rock> (rock.tsx) is `priority`, so next/image already emits an
            identical image preload in the SSR <head> (which also warms the cache
            the WebGL <Rocks> useTexture then hits). A manual dup just doubled the
            <link> for the same href. See docs/performance-audit.md A3. */}
        {/* The volumetric clouds' sprite (cloud-canvas.tsx <Clouds texture>).
            Its ONLY consumer is THREE's ImageLoader, whose default is
            crossOrigin="anonymous" (a CORS image request) — so the preload
            must say so too, or it never matches (audit H2). Gated with the
            cloud layer itself (lib/flags.ts) — an unconsumed preload is a
            wasted download + console warning.

            …and gated by `media` on the SAME two conditions cloud-layer.tsx
            uses to decide whether to mount the canvas at all (SMALL_SCREEN +
            REDUCE_MOTION), for the same reason as the typeface above: on a
            phone the volumetric canvas never mounts, so this sprite had no
            consumer and was downloaded for nothing. Keep the query in step with
            cloud-layer.tsx. */}
        {FLAGS.clouds && (
          <link
            rel="preload"
            href="/textures/cloud-puff.png"
            as="image"
            crossOrigin="anonymous"
            media="(min-width: 769px) and (prefers-reduced-motion: no-preference)"
          />
        )}
        {/* Always open at the hero on a reload. Two separate browser behaviours
            can drop a homepage load below the fold, and both must be neutralised
            here — synchronously during HTML parse, before hydration, before
            <Intro> reads scrollY, and before the anchor target even exists:
            (1) The default `scrollRestoration: "auto"` restores the previous
                scroll offset on refresh, which drops the visitor mid-page and
                makes intro-state's `atHeroTop()` read a non-zero scrollY and
                SUPPRESS the welcome. "manual" makes every reload land at the
                top; the property persists on the history entry across
                subsequent refreshes.
            (2) A fragment in the URL (the in-page nav leaves /#work, /#plans …
                behind) makes the browser scroll to that anchor as soon as the
                element renders — scrollRestoration doesn't cover fragment
                navigation. On a homepage load that anchored mid-welcome: the
                loader/intro played at the hero while the page sat at the
                section (the "glitched loader, stuck at #work" refresh bug).
                Stripping the hash NOW (before the section is parsed, so the
                anchor lookup never matches) keeps the load at the hero and the
                welcome intact. Homepage only: interior deep links like
                /pricing#book have no welcome and must keep anchoring.
            Belt-and-suspenders: some engines/profiles still sneak a scroll in
            around load (late restoration, anchor timing) despite the two
            guards above — so on homepage loads the viewport is ALSO zeroed
            here and once more when `load` fires. Harmless when already at the
            top; during a welcome the scroll is Lenis-locked anyway, so this
            can never yank a real user interaction. intro.tsx re-zeroes a
            final time right before it measures the hero (the last write
            wins). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if('scrollRestoration' in history)history.scrollRestoration='manual';" +
              "if(location.pathname==='/'){" +
              "if(location.hash)history.replaceState(null,'',location.pathname+location.search);" +
              "scrollTo(0,0);" +
              "addEventListener('load',function(){scrollTo(0,0)},{once:true});" +
              "}",
          }}
        />
        {/* Stamp the persisted sky mode onto <html> before first paint, so the
            correct --sky-* gradient (globals.css [data-mode]) and cloud palette
            render immediately — no flash of day-blue before hydration. Same
            synchronous-during-parse trick as the scripts around it; falls back to
            'day' on any invalid/blocked storage. Must match MODE_STORAGE_KEY +
            THEME_MODES in lib/theme/palette.ts. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var m=localStorage.getItem('ascnd:mode');document.documentElement.dataset.mode=['sunrise','day','sunset','night'].indexOf(m)>-1?m:'day';}catch(e){document.documentElement.dataset.mode='day';}",
          }}
        />
        {/* Arm the on-load reveal before first paint. This runs synchronously
            during HTML parse (the same flash-prevention trick next-themes uses),
            so the `.reveal-armed` hidden state in globals.css applies the instant
            the hero renders — no flash of final-position text before hydration.
            JS-gated by design: no-JS visitors never get the class, so all text
            stays visible. The GSAP timeline (hero-reveal.tsx) then animates it in;
            the cliffs use the same armed state for their drift entrance
            (rock-reveal.tsx). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('reveal-armed');",
          }}
        />
        {/* Adaptive-quality boot: detects refresh rate + GPU strength, picks a
            starting tier, and arms the frame-time watchdog on the shared ticker
            (docs/performance-audit.md §6). Renders nothing. */}
        <QualityController />
        {/* Crossfades the DOM sky (--sky-* vars) when the mode changes; renders
            nothing. Pairs with ThemeRig inside the cloud canvas (same CROSSFADE). */}
        <ThemeDriver />
        <LenisProvider>
          {/* Two independent fixed layers at the root: the sky backdrop
              (-z-20) and the volumetric clouds (-z-10), with page content
              stacking above both. Both must stay at the root — a blurred
              ancestor would break their `position: fixed`. The cloud layer is
              flag-benched (lib/flags.ts): flipped off, neither cloud canvas
              mounts and no cloud chunk/texture is ever fetched. */}
          <Background />
          {FLAGS.clouds && <CloudLayer />}
          {/* Shared-canvas host (docs/canvas-consolidation-plan.md Phase 1): two
              fixed effect planes (FRONT z-61 / REAR -z-10) that mount a <Canvas>
              only while a feature has registered a view via useSharedView. A
              sibling of the fixed sky layers (never an ancestor with a
              filter/backdrop-filter), and inside LenisProvider so its ticker-end
              advance pump rides the one shared GSAP ticker. With no views
              registered it renders nothing and creates no GL context. */}
          <SharedCanvasHost />
          {children}
          {/* Custom cursor — last child so it paints on top (its glass lens
              samples everything behind it), and a sibling of the fixed sky
              layers so no filter/backdrop-filter ancestor breaks it. Gated to
              real-mouse desktops; renders nothing otherwise. */}
          <Cursor />
          {/* Sky-mode switcher — a fixed left-edge glass rail. Sibling of the
              fixed sky layers (no filter/backdrop-filter ancestor), so it never
              breaks their position:fixed. */}
          <ModeSwitcher />
        </LenisProvider>
      </body>
    </html>
  );
}

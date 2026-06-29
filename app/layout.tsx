import type { Metadata } from "next";
import { Geist_Mono, Instrument_Serif } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Background from "@/components/background/background";
import CloudLayer from "@/components/background/cloud-layer";
import LenisProvider from "@/components/providers/lenis-provider";

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
    { path: "./fonts/ProductSans-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/ProductSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/ProductSans-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/ProductSans-Bold.ttf", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "ascnd — your design and front-end team without the hiring",
  description:
    "Subscribe and request unlimited brand, web, and product design. Delivered in days, shipped as real code.",
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
            scene's ready signal. React 19 hoists this preload into <head>. */}
        <link
          rel="preload"
          href="/fonts/product-sans-medium.typeface.json"
          as="fetch"
        />
        {/* Warm the two bare cliff cut-outs during HTML parse. They're the
            heaviest assets on the intro's ready gate (the WebGL <Rocks> suspend
            on them) AND back the DOM cliffs, yet today they don't start
            downloading until the lazy WebGL chunk has parsed and the scene has
            mounted — deeply serial. Preloading as image overlaps that ~1MB with
            the chunk download (useTexture / next-image then hit a warm cache). */}
        <link rel="preload" href="/rocks/left-rock.webp" as="image" />
        <link rel="preload" href="/rocks/right-rock.webp" as="image" />
        {/* The loader's cloud sprite (intro-loader.tsx) — small, and the real
            WebGL clouds reuse the same file, so one warm cache serves both. */}
        <link rel="preload" href="/textures/cloud-puff.png" as="image" />
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
        <LenisProvider>
          {/* Two independent fixed layers at the root: the sky backdrop
              (-z-20) and the volumetric clouds (-z-10), with page content
              stacking above both. Both must stay at the root — a blurred
              ancestor would break their `position: fixed`. */}
          <Background />
          <CloudLayer />
          {children}
        </LenisProvider>
      </body>
    </html>
  );
}

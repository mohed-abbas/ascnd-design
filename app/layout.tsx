import type { Metadata } from "next";
import { Geist_Mono, Instrument_Serif } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Background from "./components/background";
import LenisProvider from "./components/lenis-provider";
import CloudModeToggle from "./components/cloud-mode-toggle";

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
        {/* Arm the on-load reveal before first paint. This runs synchronously
            during HTML parse (the same flash-prevention trick next-themes uses),
            so the `.reveal-armed` hidden state in globals.css applies the instant
            the hero renders — no flash of final-position text before hydration.
            JS-gated by design: no-JS visitors never get the class, so all text
            stays visible. The GSAP timeline (hero-reveal.tsx) then animates it in. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.add('reveal-armed')",
          }}
        />
        <LenisProvider>
          <Background />
          {children}
          {/* Dev/review aid: switch cloud render mode (Lit vs Flat). */}
          <CloudModeToggle />
        </LenisProvider>
      </body>
    </html>
  );
}

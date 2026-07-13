"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFooterGlassEligible } from "./footer-glass-config";
import { getMode } from "@/lib/theme/mode-store";
import { useMode } from "@/lib/theme/use-mode";
import { CROSSFADE, type ThemeMode } from "@/lib/theme/palette";
import {
  INTRO_REVEAL_EVENT,
  introHasRevealed,
  introWillPlay,
} from "@/components/sections/intro/intro-state";

// The WebGL scene is client-only; ssr:false must live in a Client Component.
const FooterGlassScene = dynamic(() => import("./footer-glass-scene"), {
  ssr: false,
});

// Per-mode baked stills of the live canvas (mountains + glass wordmark), read
// back from the WebGL buffer WITH alpha — the sky is transparent, so the real
// DOM sky gradient (and any clouds behind the footer) shows through, exactly
// like the live canvas. One per theme mode so the poster is indistinguishable
// from the live render in EVERY mode, not just day. Triple duty: the
// ineligible-device fallback, the eligible-device POSTER covering the canvas
// spin-up, and the thing warmFooterGlass prefetches.
const posterSrc = (mode: ThemeMode) =>
  `/footer/footer-glass-fallback-${mode}.webp`;

// ── Warm-up (layer 1) ────────────────────────────────────────────────────────
// Prefetch the footer glass payloads during the light mid-page sections, long
// before the canvas mounts: the scene chunk (whose module scope preloads the
// mountain texture + typeface via drei), plus the current mode's poster.
// Idempotent — safe to call from several triggers. What it CANNOT warm is the
// WebGL context + shader compile (per-context); those get their runway from the
// early mount (layer 2) and are covered by the poster (layer 3).
let warmed = false;
function warmFooterGlass() {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  import("./footer-glass-scene");
  const img = new window.Image();
  img.src = posterSrc(getMode());
}

/**
 * The baked posters, stacked per theme mode. Only modes that have been active
 * this session are in the DOM (no eager 4× download); the current mode's still
 * is visible, previous ones fade under it — a theme switch while the poster
 * shows crossfades in step with the DOM sky (CROSSFADE), and the old still
 * stays painted while the new file decodes, so there's never a blank frame.
 * `hidden` (the live canvas is ready) fades whichever poster is up in the same
 * 300ms the single-poster version used.
 */
function PosterStack({
  mode,
  hidden,
  brand,
}: {
  mode: ThemeMode;
  /** Live canvas painting underneath — fade the whole stack away. */
  hidden: boolean;
  /** Ineligible fallback duty: the visible still carries the brand name. */
  brand?: boolean;
}) {
  // Accumulate the modes seen this session (render-phase adjustment — the
  // React-endorsed alternative to a setState effect for prop history).
  const [shown, setShown] = useState<ThemeMode[]>([mode]);
  if (!shown.includes(mode)) setShown([...shown, mode]);
  const stack = shown.includes(mode) ? shown : [...shown, mode];

  return (
    <>
      {stack.map((m) => {
        const active = m === mode && !hidden;
        return (
          <Image
            key={m}
            src={posterSrc(m)}
            alt={brand && m === mode ? "ascnd" : ""}
            aria-hidden={!(brand && m === mode)}
            fill
            sizes="100vw"
            loading="lazy"
            className="pointer-events-none select-none object-cover transition-opacity"
            style={{
              opacity: active ? 1 : 0,
              // Poster→live swap keeps the quick fade; poster→poster theme
              // switches recolour in step with the DOM sky's crossfade.
              transitionDuration: hidden
                ? "300ms"
                : `${CROSSFADE.duration * 1000}ms`,
            }}
          />
        );
      })}
    </>
  );
}

/**
 * Footer scene controller — decides what fills the footer box:
 *  - INELIGIBLE (SSR / no-JS / mobile / reduced-motion / no-WebGL): the baked
 *    per-mode still, statically (it retints with the theme via PosterStack).
 *  - ELIGIBLE (desktop + WebGL + motion): the SAME baked still as an instant
 *    poster, with the live liquid-glass WebGL canvas mounted on top once the
 *    footer comes within ~6 viewports (IntersectionObserver). When the canvas
 *    reports its first real painted frames (onReady), the poster fades out —
 *    so the footer always looks complete on arrival, even on an End-key jump or
 *    deep link, while the app's heaviest shader spins up underneath. The canvas
 *    is still DEFERRED so it never contends with the intro at page load.
 */
export default function FooterScene() {
  const eligible = useFooterGlassEligible();
  const mode = useMode();
  const [near, setNear] = useState(false);
  const [live, setLive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleReady = useCallback(() => setLive(true), []);

  // Layer 1 trigger: warm once the welcome is over (its assets own the load
  // window — see the slow-network intro hardening), or shortly after mount when
  // no intro will play. First scroll is the belt-and-braces fallback for an
  // intro that intended to play but bailed.
  useEffect(() => {
    if (!eligible) return;
    if (!introWillPlay() || introHasRevealed()) {
      const t = setTimeout(warmFooterGlass, 2000);
      return () => clearTimeout(t);
    }
    window.addEventListener(INTRO_REVEAL_EVENT, warmFooterGlass, {
      once: true,
    });
    window.addEventListener("scroll", warmFooterGlass, {
      once: true,
      passive: true,
    });
    return () => {
      window.removeEventListener(INTRO_REVEAL_EVENT, warmFooterGlass);
      window.removeEventListener("scroll", warmFooterGlass);
    };
  }, [eligible]);

  // Layer 2: mount the canvas ~6 viewports early. The bytes are already local
  // (layer 1), so this runway is spent on what can't be prefetched — context
  // creation + the MTM shader compile + the mount paint burst — which all
  // finish before a normal scroll arrives.
  useEffect(() => {
    if (!eligible || near) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "600% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eligible, near]);

  // Ineligible (and SSR) — the baked still fills the box (its aspect matches
  // the box, so object-cover doesn't crop). Carries the brand name, and the
  // transparent sky lets the DOM gradient keep it in-theme.
  if (!eligible) {
    return <PosterStack mode={mode} hidden={false} brand />;
  }

  // Eligible — poster underneath (layer 3), live glass on top once near; the
  // poster fades out on the canvas's onReady so the swap is invisible.
  return (
    <div ref={ref} className="absolute inset-0">
      <PosterStack mode={mode} hidden={live} />
      {near && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <FooterGlassScene onReady={handleReady} />
        </div>
      )}
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFooterGlassEligible } from "./footer-glass-config";
import {
  INTRO_REVEAL_EVENT,
  introHasRevealed,
  introWillPlay,
} from "@/components/sections/intro/intro-state";

// The WebGL scene is client-only; ssr:false must live in a Client Component.
const FooterGlassScene = dynamic(() => import("./footer-glass-scene"), {
  ssr: false,
});

// The baked composite (mountains + glass wordmark flattened from the live look).
// Triple duty: the ineligible-device fallback, AND the eligible-device POSTER
// that covers the canvas spin-up, AND the thing warmFooterGlass prefetches.
const POSTER_SRC = "/footer/footer-glass-fallback.webp";

// ── Warm-up (layer 1) ────────────────────────────────────────────────────────
// Prefetch the footer glass payloads during the light mid-page sections, long
// before the canvas mounts: the scene chunk (whose module scope preloads the
// mountain texture + typeface via drei), plus the poster image. Idempotent —
// safe to call from several triggers. What it CANNOT warm is the WebGL context
// + shader compile (per-context); those get their runway from the early mount
// (layer 2) and are covered by the poster (layer 3).
let warmed = false;
function warmFooterGlass() {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  import("./footer-glass-scene");
  const img = new window.Image();
  img.src = POSTER_SRC;
}

/**
 * Footer scene controller — decides what fills the footer box:
 *  - INELIGIBLE (SSR / no-JS / mobile / reduced-motion / no-WebGL): the baked
 *    composite image, statically.
 *  - ELIGIBLE (desktop + WebGL + motion): the SAME baked composite as an instant
 *    poster, with the live liquid-glass WebGL canvas mounted on top once the
 *    footer comes within ~6 viewports (IntersectionObserver). When the canvas
 *    reports its first real painted frames (onReady), the poster fades out —
 *    so the footer always looks complete on arrival, even on an End-key jump or
 *    deep link, while the app's heaviest shader spins up underneath. The canvas
 *    is still DEFERRED so it never contends with the intro at page load.
 */
export default function FooterScene() {
  const eligible = useFooterGlassEligible();
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

  // Ineligible (and SSR) — the baked composite fills the box (its aspect
  // matches the box, so object-cover doesn't crop). Carries the brand name.
  if (!eligible) {
    return (
      <Image
        src={POSTER_SRC}
        alt="ascnd"
        fill
        sizes="100vw"
        loading="lazy"
        className="pointer-events-none select-none object-cover"
      />
    );
  }

  // Eligible — poster underneath (layer 3), live glass on top once near; the
  // poster fades out on the canvas's onReady so the swap is invisible.
  return (
    <div ref={ref} className="absolute inset-0">
      <Image
        src={POSTER_SRC}
        alt=""
        aria-hidden
        fill
        sizes="100vw"
        loading="lazy"
        className={`pointer-events-none select-none object-cover transition-opacity duration-300 ${
          live ? "opacity-0" : "opacity-100"
        }`}
      />
      {near && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <FooterGlassScene onReady={handleReady} />
        </div>
      )}
    </div>
  );
}

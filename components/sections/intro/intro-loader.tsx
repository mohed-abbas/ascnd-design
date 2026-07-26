"use client";

import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import Logo from "@/components/ui/logo";
// Wordmark temporarily disabled in the loader column (see commented block below).
// import Wordmark from "@/components/ui/wordmark";
import {
  documentLoadedOnHome,
  INTRO_CHUNK_READY_EVENT,
  INTRO_GO_EVENT,
  INTRO_LAST_RESORT_MS,
  INTRO_REVEAL_EVENT,
  INTRO_SCENE_READY_EVENT,
  introHasRevealed,
  introPending,
  welcomeWillPlay,
} from "./intro-state";

// Layout effect on the client so the no-welcome mount decision lands BEFORE
// paint (an SPA arrival must never flash even one frame of the cover); plain
// effect during SSR to avoid React's server warning. Mirrors intro.tsx.
const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Welcome loading screen — a PURE DOM/CSS cover shown over the sky while the
 * heavy WebGL intro warms up (the Three.js/drei chunk downloads + parses, the
 * rock/shot textures load, the transmission shader compiles). It deliberately
 * uses NO WebGL: the real volumetric clouds run on the same Three stack we're
 * waiting on, so a WebGL loader would take just as long to appear.
 *
 * Layout follows the Figma "Hero base" loader (node 263:198): a vertically-
 * centred column — the ascend chevron mark, the "ascnd" wordmark, then a
 * hairline progress bar — over the existing DOM sky. It carries NO background of
 * its own: the global <Background/> (#62abff + grain) shows through, so there's
 * no double-grain and the handoff to the live scene is on the exact same sky.
 *
 * THE LOADER LEADS (see intro-state.ts INTRO_GO_EVENT), and the welcome is
 * NEVER skipped for being slow — the cover holds for as long as the scene
 * genuinely takes, with the bar advancing on REAL loading milestones so it
 * always shows loading truth, never a parked fake:
 *   t≈0.2s  logo masked-reveal (rises from behind its own clip line)  [CSS]
 *   0.3s→   hairline sweeps to ~10% fast, then crawls toward ~22% over ~30s —
 *           pre-hydration the page KNOWS nothing (main JS still downloading),
 *           so CSS alone keeps honest, visible motion            [CSS only]
 *   hydrate JS takes over from the bar's current position and creeps toward
 *           35% — "app booted, scene chunk downloading"          [milestone]
 *   chunk   INTRO_CHUNK_READY (three.js/drei parsed) → creep toward 70% —
 *           on slow networks this is most of the wait            [milestone]
 *   ready   INTRO_SCENE_READY (textures + shaders + frames painted) → the bar
 *           runs out to 100%, lands, and the 0.6s fade begins    [milestone]
 *   (fade done) dispatch INTRO_GO → the intro timeline starts on clean sky.
 * A ~2.4s minimum show keeps the choreography intentional on fast connections
 * (scene-ready usually beats it; dismiss waits for both). Between milestones
 * the bar eases asymptotically toward its cap, so it is always moving.
 * INTRO_REVEAL (intro bailed: can't place the glass, or the LAST-RESORT wedge
 * net fired) drops the cover immediately; a local hard-cap just above the
 * last-resort budget guarantees the cover can't outlive a crashed intro.
 *
 * It is rendered on the server too (markup ships in the initial HTML) and is
 * visible by default. The play decision runs at mount:
 *   • welcome pending  → run the welcome above, then hand off via INTRO_GO.
 *   • homepage hard load but suppressed (mid-page/no-WebGL/?intro=skip) → drop
 *     the SSR cover next frame; the DOM hero reveals with nothing to wait on.
 *   • client-side arrival (SPA nav back to the homepage, or the document
 *     loaded on an interior route) → unmount before paint; the cover — like
 *     the welcome itself — belongs to first load and refresh only.
 *
 * Reduced motion hides it entirely via CSS (`display:none`), so those visitors
 * never see it — and introWillPlay() is false for them regardless.
 */

// Minimum show — keeps the entrance choreography intentional on fast
// connections (scene-ready usually lands inside it; dismiss waits for both).
const MIN_SHOW_MS = 2400;
// Let the bar's final run-out visibly land before the fade starts, so
// "complete" reads as a beat rather than a blink.
const BAR_LAND_MS = 250;
// Hard cap: the cover must never outlive a crashed intro. Sits just above
// intro.tsx's INTRO_LAST_RESORT_MS (which fires INTRO_REVEAL in every live
// path), so it only ever fires when no signal arrived at all.
const HOLD_LIMIT_MS = INTRO_LAST_RESORT_MS + 2000;

// Progress caps per milestone — the bar creeps asymptotically toward the cap
// of the deepest milestone reached, so it always moves but never lies ahead
// of more than the next phase. scene-ready runs it out to 1.
const CAP_HYDRATED = 0.35;
const CAP_CHUNK = 0.7;

// ── The no-glass path (phones; see intro-state.ts welcomeWillPlay) ──
// With no WebGL scene to warm, the milestones the bar normally rides
// (INTRO_CHUNK_READY / INTRO_SCENE_READY) never fire, so the cover must time
// itself or it would hold until the HOLD_LIMIT_MS wedge net (47s). It still
// shows for a real beat rather than blinking: `document.fonts.ready` IS a
// genuine milestone here — the hero cascade waits on it too (hero-reveal.tsx),
// so covering it is the difference between a composed entrance and a visible
// font swap. Shorter min-show than the WebGL path because there is no heavy
// chunk behind it to justify the longer hold.
const NO_GLASS_MIN_SHOW_MS = 1600;
const NO_GLASS_CAP_HYDRATED = 0.6;
const NO_GLASS_CAP_FONTS = 0.9;

export default function IntroLoader() {
  // `dismissing` fades the cover out; `done` unmounts it once the fade settles.
  // Both start false → visible on load.
  const [dismissing, setDismissing] = useState(false);
  const [done, setDone] = useState(false);
  const fillRef = useRef<HTMLSpanElement>(null);
  // Set on the no-glass path (below): this loader is the whole intro, so it —
  // not <Intro> — is what fires INTRO_REVEAL when the cover lifts.
  const ownsReveal = useRef(false);

  useIso(() => {
    const dismiss = () => setDismissing(true);

    // No welcome pending this document load. Two flavours:
    //  • Client-side arrival — the welcome already ran (nav back to the
    //    homepage) or this document loaded on an interior route: there is no
    //    SSR cover on screen and none must ever paint. Unmount synchronously
    //    (layout effect runs pre-paint) so not even one frame of logo flashes.
    //  • Homepage HARD load with the welcome suppressed (?intro=skip, no
    //    WebGL; reduced-motion never shows the cover via CSS): the SSR cover
    //    has been visible since first paint — drop it on the next frame with
    //    the soft fade (a flash of matching sky, never a lingering hold).
    if (!introPending()) {
      if (introHasRevealed() || !documentLoadedOnHome()) {
        setDone(true);
        return;
      }
      const raf = requestAnimationFrame(dismiss);
      return () => cancelAnimationFrame(raf);
    }

    // ── The no-glass path: an intro is owed, but no WebGL scene will mount ──
    // Phones. The loader is the WHOLE intro here, so it also owns the handoff:
    // nothing else will ever fire INTRO_REVEAL, and the hero / rocks / clouds /
    // design-shots are all parked waiting for it. Self-timed against the two
    // things that are genuinely still loading (fonts, and the minimum show),
    // then it lifts and fires the reveal from onTransitionEnd below.
    if (!welcomeWillPlay()) {
      ownsReveal.current = true;
      const fill = fillRef.current;
      let creep: gsap.core.Tween | undefined;
      const advance = (cap: number, duration: number) => {
        if (!fill) return;
        creep?.kill();
        creep = gsap.to(fill, { scaleX: cap, duration, ease: "power2.out" });
      };
      if (fill) {
        // Same handoff as the milestone path: continue from wherever the CSS
        // crawl reached instead of snapping back.
        const m = getComputedStyle(fill).transform.match(/matrix\(([\d.]+)/);
        fill.style.animation = "none";
        gsap.set(fill, { scaleX: m ? Number(m[1]) : 0, transformOrigin: "left center" });
        advance(NO_GLASS_CAP_HYDRATED, 1.2);
      }

      let minElapsed = false;
      let fontsReady = false;
      let dismissed = false;
      let landTimer: number | undefined;
      const maybeDismiss = () => {
        if (dismissed || !minElapsed || !fontsReady) return;
        dismissed = true;
        advance(1, 0.25);
        landTimer = window.setTimeout(dismiss, BAR_LAND_MS);
      };
      const minTimer = window.setTimeout(() => {
        minElapsed = true;
        maybeDismiss();
      }, NO_GLASS_MIN_SHOW_MS);
      // Never block on a font that fails to load: resolve the milestone either
      // way, so a blocked/offline font file can't strand the cover.
      let cancelled = false;
      document.fonts.ready.then(() => {
        if (cancelled) return;
        fontsReady = true;
        advance(NO_GLASS_CAP_FONTS, 0.6);
        maybeDismiss();
      });
      const fontsFailsafe = window.setTimeout(() => {
        if (cancelled || fontsReady) return;
        fontsReady = true;
        maybeDismiss();
      }, 4000);

      return () => {
        cancelled = true;
        window.clearTimeout(minTimer);
        window.clearTimeout(fontsFailsafe);
        if (landTimer !== undefined) window.clearTimeout(landTimer);
        creep?.kill();
      };
    }

    // ── The milestone-driven bar ──
    // JS is here, so the "app booted" milestone is reached by definition. Take
    // over from wherever the CSS crawl got the bar (no jump: read the computed
    // scale, kill the CSS animation, continue from there via GSAP on the
    // shared ticker), then creep toward each milestone's cap.
    const fill = fillRef.current;
    let creep: gsap.core.Tween | undefined;
    const advance = (cap: number, duration: number, ease = "power2.out") => {
      if (!fill) return;
      creep?.kill();
      creep = gsap.to(fill, { scaleX: cap, duration, ease });
    };
    if (fill) {
      const m = getComputedStyle(fill).transform.match(/matrix\(([\d.]+)/);
      const current = m ? Number(m[1]) : 0;
      fill.style.animation = "none"; // CSS animation would pin the transform
      gsap.set(fill, { scaleX: current, transformOrigin: "left center" });
      advance(CAP_HYDRATED, 6); // hydrated — chunk downloading
    }
    const onChunk = () => advance(CAP_CHUNK, 6); // chunk parsed — textures/compile next

    // Hold the cover until the minimum show has elapsed AND the scene has
    // genuinely painted, then run the bar out and fade.
    let minElapsed = false;
    let sceneReady = false;
    let dismissed = false;
    let landTimer: number | undefined;
    const maybeDismiss = () => {
      if (dismissed || !minElapsed || !sceneReady) return;
      dismissed = true;
      // bar is running out to 100% (onReady) — let it land, then fade
      landTimer = window.setTimeout(dismiss, BAR_LAND_MS);
    };
    const onReady = () => {
      sceneReady = true;
      advance(1, 0.25, "power2.inOut"); // the real finish line
      maybeDismiss();
    };
    const minTimer = window.setTimeout(() => {
      minElapsed = true;
      maybeDismiss();
    }, MIN_SHOW_MS);
    // Bail: <Intro> fired REVEAL without a scene (couldn't place the glass, or
    // the last-resort wedge net) — the DOM hero is cascading in, drop the
    // cover now.
    const onReveal = () => {
      if (dismissed) return;
      dismissed = true;
      dismiss();
    };
    const capTimer = window.setTimeout(onReveal, HOLD_LIMIT_MS);
    window.addEventListener(INTRO_CHUNK_READY_EVENT, onChunk, { once: true });
    window.addEventListener(INTRO_SCENE_READY_EVENT, onReady, { once: true });
    window.addEventListener(INTRO_REVEAL_EVENT, onReveal, { once: true });
    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(capTimer);
      if (landTimer !== undefined) window.clearTimeout(landTimer);
      window.removeEventListener(INTRO_CHUNK_READY_EVENT, onChunk);
      window.removeEventListener(INTRO_SCENE_READY_EVENT, onReady);
      window.removeEventListener(INTRO_REVEAL_EVENT, onReveal);
      creep?.kill();
    };
  }, []);

  if (done) return null;

  return (
    <div
      data-intro-loader
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[80] grid place-items-center overflow-hidden transition-opacity duration-[600ms] ease-out ${
        dismissing ? "opacity-0" : "opacity-100"
      }`}
      onTransitionEnd={() => {
        if (!dismissing) return;
        // No-glass path (phones): nothing else will ever fire the reveal, so
        // release the parked hero/rocks/clouds/collage here — the cover has
        // finished fading, so their cascade begins on clean sky exactly as the
        // glass dock would have started it.
        if (ownsReveal.current && !introHasRevealed()) {
          window.dispatchEvent(new Event(INTRO_REVEAL_EVENT));
        }
        // Faded out — hand off. <Intro> starts its timeline on the now-clean sky;
        // the scene warmed up under the cover, so there's no stall. A no-op when
        // <Intro> never mounted (its only listener).
        window.dispatchEvent(new Event(INTRO_GO_EVENT));
        setDone(true);
      }}
    >
      {/* The Figma "LogoContent" column (node 263:220) — chevron mark, wordmark,
          hairline progress, stacked with a 50px gap and centre-aligned. */}
      <div className="flex flex-col items-center gap-[50px]">
        {/* Logo — masked reveal: rises from behind its own clip line. */}
        <div className="loader-reveal">
          <div
            className="loader-rise"
            style={{ "--rise-delay": "0.2s" } as CSSProperties}
          >
            <Logo className="block w-[204px] text-white" />
          </div>
        </div>
        {/* Wordmark — masked reveal, staggered a beat behind the logo. */}
        {/* <div className="loader-reveal">
          <div
            className="loader-rise"
            style={{ "--rise-delay": "0.45s" } as CSSProperties}
          >
            <Wordmark className="block text-[38.5px]" />
          </div>
        </div> */}
        {/* Determinate hairline progress (node 263:227): CSS sweeps/crawls the
            fill pre-hydration; JS then drives it on real loading milestones
            (hydrated → chunk parsed → scene painted → 100%), then the whole
            cover fades. */}
        <div className="loader-track">
          <span ref={fillRef} className="loader-fill" />
        </div>
      </div>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useLenis } from "lenis/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import gsap from "gsap";
import {
  INTRO_REVEAL_EVENT,
  introWillPlay,
  markIntroSeen,
} from "./intro-state";
import { CAMERA_Z, ROCK_Z } from "./intro-scene";
import type { GlassAnim, RockEntry, RockLayout } from "./intro-scene";

// The rock planes render at ROCK_Z (behind the glass), so they project slightly
// toward screen centre vs the z=0 mapping below. Scale their world coords by this
// to cancel it — they land flush to the viewport edges, matching the DOM rocks.
const ROCK_DEPTH = (CAMERA_Z - ROCK_Z) / CAMERA_Z;

const IntroScene = dynamic(() => import("./intro-scene"), { ssr: false });

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Client-only "should the intro play" decision, the same useSyncExternalStore
// pattern as cloud-layer.tsx: SSR snapshot is false (cheap server render), the
// client re-evaluates after hydration — no mismatch, no setState-in-effect.
const noopSubscribe = () => () => {};

// Glass "ascnd" width ≈ 2.55 × Text3D `size` (advances + the -0.03em tracking).
const WIDTH_PER_SIZE = 2.55;
const NAVBAR_FONT_PX = 38; // matches the DOM <Wordmark> (text-[38px]) dock target
const WELCOME_LIFT = 52; // glyph sits 52px above the hero middle (Figma 200:203)
const WELCOME_NUDGE_X = -4.91;
const GLASS_RISE_PX = 170; // glass slides up this far into the welcome spot
const ROCK_DRIFT_PX = 10; // rocks settle down this far on entrance (matches DOM)

type Plan = {
  rocks: RockLayout[];
  glassSize: number;
  welcome: { x: number; y: number };
  navbar: { x: number; y: number; scale: number };
};

/**
 * Welcome intro orchestrator. Renders the transparent WebGL stage over the hero
 * and drives the one master GSAP timeline: the glass "ascnd" rises into place
 * (reveal), holds, then docks (shrinks + travels) onto the navbar wordmark slot,
 * refracting the rocks/sky on the way. At ~⅔ through the dock it fires
 * INTRO_REVEAL_EVENT so <HeroReveal> cascades the hero in underneath; then the
 * canvas fades out, handing off to the real DOM wordmark.
 *
 * Plays once per session, locks Lenis scroll while running, and is skipped under
 * reduced-motion (see intro-state). Measures the DOM and converts to the scene's
 * world units (perspective camera) so the glass lines up with the hero.
 *
 * Dev query hooks: ?intro=force|skip · ?introslow=N (N× slower) · ?intropos=P
 * (freeze at progress 0..1).
 */
export default function Intro() {
  const shouldPlay = useSyncExternalStore(
    noopSubscribe,
    () => introWillPlay(),
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  const play = shouldPlay && !dismissed;

  const [plan, setPlan] = useState<Plan | null>(null);
  // The WebGL scene is lazy-loaded and its textures/font/HDR load under Suspense.
  // Gate the timeline on the scene actually being painted (onReady) so the
  // entrance plays from the top instead of mid-animation (the "pop" after the
  // brief sky-only flash).
  const [ready, setReady] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const anim = useRef<GlassAnim>({ x: 0, y: 0, scale: 1, rotX: 0, rotY: 0 });
  const rockEntries = useRef<RockEntry[]>([]);

  // useLenis() can return a fresh ref across renders; mirror it into a ref so the
  // master-timeline effect can depend only on [play, plan] and never churn
  // (re-running it would kill + restart the timeline mid-intro).
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

  // Measure the hero once we're going to play, and build the plan.
  useIso(() => {
    if (!play) return;

    const hero = document.querySelector<HTMLElement>("[data-hero]");
    const slot = document.querySelector<HTMLElement>("[data-wordmark-slot]");
    if (!hero || !slot) {
      // Can't place the glass — bail gracefully and let the hero reveal.
      window.dispatchEvent(new Event(INTRO_REVEAL_EVENT));
      markIntroSeen();
      setDismissed(true);
      return;
    }

    const W = window.innerWidth;
    const H = window.innerHeight;
    // Perspective camera (z=10, fov=45): the z=0 plane spans 8.284 world units
    // vertically, so 1 CSS px ≈ wpp world units. Convert DOM centres to world.
    const wpp = 8.284 / H;
    const toWorld = (cx: number, cy: number) => ({
      x: (cx - W / 2) * wpp,
      y: (H / 2 - cy) * wpp,
    });

    const h = hero.getBoundingClientRect();
    const heroCx = h.left + h.width / 2;
    const heroMidY = h.top + h.height / 2;

    const glassW = Math.min(1292, W - 32);
    const glassEmPx = glassW / WIDTH_PER_SIZE; // em box in px
    const glassSize = glassEmPx * wpp; // Text3D size, world units

    const welcome = toWorld(heroCx + WELCOME_NUDGE_X, heroMidY - WELCOME_LIFT);

    const s = slot.getBoundingClientRect();
    const navCenter = toWorld(s.left + s.width / 2, s.top + s.height / 2);
    const navbar = {
      x: navCenter.x,
      y: navCenter.y,
      scale: NAVBAR_FONT_PX / glassEmPx, // unitless: navbar em ÷ glass em
    };

    const rocks: RockLayout[] = (["left", "right"] as const)
      .map((side) => {
        const el = document.querySelector<HTMLElement>(
          `[data-rock-side="${side}"]`,
        );
        if (!el) return null;
        // The DOM rock is parked with `transform: translateY(-10px)` (the
        // .reveal-armed drift start), which would push the WebGL plane 10px
        // high of the cliff's resting spot. Neutralise it for the measure so
        // the plane sits exactly where the opacity-only DOM rock lands at the
        // crossfade (rock-reveal.tsx) — no slide at the handoff.
        const prevTransform = el.style.transform;
        el.style.transform = "none";
        const r = el.getBoundingClientRect();
        el.style.transform = prevTransform;
        const c = toWorld(r.left + r.width / 2, r.top + r.height / 2);
        // Scale about screen centre (×ROCK_DEPTH) so the plane, drawn at ROCK_Z,
        // projects to exactly this measured rect — flush to the edges, no gap.
        return {
          src: side === "left" ? "/rocks/left-rock.png" : "/rocks/right-rock.png",
          cx: c.x * ROCK_DEPTH,
          cy: c.y * ROCK_DEPTH,
          w: r.width * wpp * ROCK_DEPTH,
          h: r.height * wpp * ROCK_DEPTH,
        };
      })
      .filter((r): r is RockLayout => r !== null);

    // Seed the glass at its reveal start: parked low (slides straight up into
    // place, like the hero text — no scale pop).
    anim.current.x = welcome.x;
    anim.current.y = welcome.y - GLASS_RISE_PX * wpp;
    anim.current.scale = 1;

    // Seed each rock hidden + lifted a touch, for the drift entrance (the WebGL
    // mirror of the DOM rocks' drift: fade in + small downward settle).
    rockEntries.current = rocks.map(() => ({
      opacity: 0,
      yOffset: ROCK_DRIFT_PX * wpp,
    }));

    setPlan({ rocks, glassSize, welcome, navbar });
  }, [play]);

  // Failsafe: if the scene never signals ready (slow GPU, load hiccup), start
  // anyway so the intro can't hang on a blank sky.
  useEffect(() => {
    if (!play) return;
    const t = window.setTimeout(() => setReady(true), 2500);
    return () => window.clearTimeout(t);
  }, [play]);

  // Run the master timeline once the plan is built AND the scene has painted.
  // Scroll locks as soon as we commit to playing (even during the load), but the
  // timeline itself is only built on `ready` so the entrance plays from frame 0.
  useEffect(() => {
    if (!play || !plan) return;

    lenisRef.current?.stop(); // lock now — keep it locked through the load
    if (!ready) {
      // Waiting on the scene; stay locked, release if we unmount before it paints.
      return () => {
        lenisRef.current?.start();
      };
    }

    const animObj = anim.current; // stable target for cleanup (ref-safe)
    const rockObjs = rockEntries.current;

    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      window.dispatchEvent(new Event(INTRO_REVEAL_EVENT));
    };

    const tl = gsap.timeline({
      onComplete: () => {
        markIntroSeen();
        lenisRef.current?.start();
        setDismissed(true);
      },
    });

    // Dev hook: ?introslow=N runs the timeline N× slower for inspection.
    const slow = Number(
      new URLSearchParams(window.location.search).get("introslow"),
    );
    if (slow > 1) tl.timeScale(1 / slow);

    // Absolute beats (seconds) so positions never drift off a callback ref.
    const REVEAL = 0.85;
    const HOLD = 0.45;
    const DOCK = 1.05;
    const dockStart = REVEAL + HOLD;
    const dockEnd = dockStart + DOCK;

    // ① reveal — the glass slides straight up into place (same expo.out feel as
    //    the hero text), and the rocks drift in alongside it (fade + settle, the
    //    WebGL twin of the DOM rocks' drift, left leading right).
    tl.to(
      anim.current,
      { y: plan.welcome.y, duration: REVEAL, ease: "expo.out" },
      0,
    );
    tl.to(
      rockObjs,
      {
        opacity: 1,
        yOffset: 0,
        duration: 1.1,
        ease: "power2.out",
        stagger: 0.1,
      },
      0,
    );

    // ② dock — shrink + travel onto the navbar slot (after a hold)
    tl.to(
      anim.current,
      {
        x: plan.navbar.x,
        y: plan.navbar.y,
        scale: plan.navbar.scale,
        duration: DOCK,
        ease: "power3.inOut",
      },
      dockStart,
    );

    // ③ cascade the hero in as the glass is nearly landed. This also fires the
    //    DOM-rock crossfade (rock-reveal.tsx), an opacity-only ~0.35s fade — set
    //    early enough that the DOM rocks are SOLID by dockEnd, before the canvas
    //    (carrying the WebGL rocks) starts to fade, so the crossfade never dips
    //    translucent. The DOM rocks land exactly under the WebGL rocks.
    tl.call(reveal, undefined, dockEnd - 0.35);

    // …then fade the glass + WebGL rocks out onto the now-solid DOM rocks and the
    // real DOM wordmark, once the glass has docked.
    tl.to(
      wrapperRef.current,
      { opacity: 0, duration: 0.4, ease: "power2.out" },
      dockEnd,
    );

    // Dev hook: ?intropos=P (0..1) freezes the timeline at progress P for a
    // stable inspection frame (no timing races). No failsafe while frozen.
    const posParam = new URLSearchParams(window.location.search).get("intropos");
    if (posParam !== null) {
      tl.progress(Math.min(1, Math.max(0, Number(posParam)))).pause();
      return () => {
        tl.kill();
        gsap.killTweensOf(animObj);
        gsap.killTweensOf(rockObjs);
        lenisRef.current?.start();
      };
    }

    // Safety: never strand the hero hidden if the timeline is interrupted.
    // Scaled by the dev slow factor so it doesn't fire mid-intro under slow-mo.
    const failsafe = window.setTimeout(reveal, 6000 * (slow > 1 ? slow : 1));

    return () => {
      tl.kill();
      window.clearTimeout(failsafe);
      gsap.killTweensOf(animObj);
      gsap.killTweensOf(rockObjs);
      lenisRef.current?.start();
    };
  }, [play, plan, ready]);

  if (!play || !plan) return null;

  return (
    <div
      ref={wrapperRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60]"
    >
      <IntroScene
        anim={anim}
        rocks={plan.rocks}
        rockEntry={rockEntries}
        glassSize={plan.glassSize}
        onReady={() => setReady(true)}
      />
    </div>
  );
}

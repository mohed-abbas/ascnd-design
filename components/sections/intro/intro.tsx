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
  INTRO_GO_EVENT,
  INTRO_REVEAL_EVENT,
  INTRO_START_EVENT,
  introWillPlay,
} from "./intro-state";
import { CAMERA_Z, ROCK_Z, TILE_Z } from "./intro-scene";
import { SHOTS } from "@/components/sections/design-shots/shots-spec";
import type {
  ConveyorArc,
  GlassAnim,
  RockEntry,
  RockLayout,
  TileEntry,
  TileLayout,
} from "./intro-scene";

// The rock planes render at ROCK_Z (behind the glass), so they project slightly
// toward screen centre vs the z=0 mapping below. Scale their world coords by this
// to cancel it — they land flush to the viewport edges, matching the DOM rocks.
const ROCK_DEPTH = (CAMERA_Z - ROCK_Z) / CAMERA_Z;
// Same projection compensation for the tile planes (drawn at TILE_Z).
const TILE_DEPTH = (CAMERA_Z - TILE_Z) / CAMERA_Z;

// introV2 design frame is 1920×1080; the glass "ascnd" glyph spans this many px
// in it, and its centre sits this far below the frame centre. The shot tiles are
// authored relative to the glass, so we anchor them to the LIVE glass: each
// scatter offset/size scales by (runtime glass width / DESIGN_GLASS_W), which
// makes the constellation track the letters at any viewport — dissolving the
// 1920-vs-1512 mismatch (it never reads design px as viewport px).
const DESIGN_GLASS_W = 1654;
const DESIGN_GLASS_DY = -24;

// Quadratic bezier on one axis — the tiles ride a curved path (scatter → control
// → necklace) so they bow toward the wordmark/clasp before draping into the arc.
const quad = (a: number, c: number, b: number, t: number) => {
  const u = 1 - t;
  return u * u * a + 2 * u * t * c + t * t * b;
};
// How hard each path is pulled toward the docking wordmark (0 = straight line).
const TILE_GATHER = 0.42;
// Squeeze the tiles' bloom spots toward the glyph's VERTICAL centre so they sit
// in the text's core band rather than poking above/below the letters (the
// far-up/down Figma scatter pushed the tiles around 'd' clear of the text).
// Vertical only — horizontal spread is left at the authored Figma value. 1 = raw
// Figma spread; smaller = tighter to the middle.
const TILE_SCATTER_VSCALE = 0.55;
// Seconds for the tiles to drape scatter → arc. Decoupled from the glass dock
// (the shots have no DOM crossfade to sync to), so it can breathe — the glass
// can land and fade while the tiles are still settling into the necklace.
const TILE_FLIGHT = 1.5;

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
// Rocks slide in from their own edge: each starts off-screen by this many of its
// own widths (≥1 guarantees it's fully past the viewport edge), then settles to 0.
const ROCK_SLIDE_FACTOR = 1.15;

/** A tile's world-space pose at one end of its journey (center + edge length). */
type TilePose = { x: number; y: number; scale: number };

type Plan = {
  rocks: RockLayout[];
  glassSize: number;
  welcome: { x: number; y: number };
  navbar: { x: number; y: number; scale: number };
  /** Static tile config (image + rounding + slot), index-matched to scatter/necklace. */
  tiles: TileLayout[];
  /** Where each tile blooms in behind the glass (Figma scatter, glass-anchored).
   *  `null` for the hidden return tile, which never flies in. */
  tileScatter: (TilePose | null)[];
  /** Where each tile lands on the hero necklace (its resting arc slot, world). */
  tileNecklace: TilePose[];
  /** The full arc slot path (world) the steady-state conveyor rides. */
  arc: ConveyorArc;
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

  // Intro phase: glass + rocks mounted in the scene, frameloop "always". Flipped
  // off at the end so the canvas PERSISTS as the cheap steady-state tile scene.
  const [introActive, setIntroActive] = useState(true);
  // Run the steady-state conveyor — started the moment the fly-in lands the tiles
  // on the arc (before the glass finishes fading), so they never freeze.
  const [conveyor, setConveyor] = useState(false);

  const [plan, setPlan] = useState<Plan | null>(null);
  // The WebGL scene is lazy-loaded and its textures/font/HDR load under Suspense.
  // Gate the timeline on the scene actually being painted (onReady) so the
  // entrance plays from the top instead of mid-animation (the "pop" after the
  // brief sky-only flash).
  const [ready, setReady] = useState(false);
  // The loader leads: it plays its welcome over the warming scene, then fires
  // INTRO_GO when it's faded out. We hold the master timeline until then so the
  // glass never rises under the cover. Failsafe-released if the cue never lands.
  const [released, setReleased] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const anim = useRef<GlassAnim>({
    x: 0,
    y: 0,
    scale: 1,
    rotX: 0,
    rotY: 0,
    reveal: 0,
    opacity: 1,
  });
  const rockEntries = useRef<RockEntry[]>([]);
  const tileEntries = useRef<TileEntry[]>([]);

  // useLenis() can return a fresh ref across renders; mirror it into a ref so the
  // master-timeline effect can depend only on [play, plan] and never churn
  // (re-running it would kill + restart the timeline mid-intro).
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

  // Warm the heavy WebGL scene chunk (Three.js + drei) the instant we know the
  // intro will play, so its download overlaps the DOM measure instead of only
  // starting when <IntroScene> first renders. Shares the module cache with the
  // dynamic() import below, so the lazy mount then resolves from cache. Gated on
  // shouldPlay so returning/reduced-motion visitors never pay for it.
  useEffect(() => {
    if (shouldPlay) void import("./intro-scene");
  }, [shouldPlay]);

  // Measure the hero once we're going to play, and build the plan.
  useIso(() => {
    if (!play) return;

    const hero = document.querySelector<HTMLElement>("[data-hero]");
    const slot = document.querySelector<HTMLElement>("[data-wordmark-slot]");
    if (!hero || !slot) {
      // Can't place the glass — bail gracefully and let the hero reveal.
      window.dispatchEvent(new Event(INTRO_REVEAL_EVENT));
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
          src: side === "left" ? "/rocks/left-rock.webp" : "/rocks/right-rock.webp",
          cx: c.x * ROCK_DEPTH,
          cy: c.y * ROCK_DEPTH,
          w: r.width * wpp * ROCK_DEPTH,
          h: r.height * wpp * ROCK_DEPTH,
        };
      })
      .filter((r): r is RockLayout => r !== null);

    // Seed the glass at the welcome spot, full scale, reveal=0 (fully below its
    // baseline clip → hidden). The reveal tween lifts it up through the clip so
    // it's unmasked in place, like the hero text — no scale pop, no fly-up.
    anim.current.x = welcome.x;
    anim.current.y = welcome.y;
    anim.current.scale = 1;
    anim.current.reveal = 0;
    anim.current.opacity = 1;

    // Seed each rock hidden and pushed off-screen toward its OWN side (sign of
    // cx: left rock has cx<0 → starts further left; right rock cx>0 → further
    // right), so the entrance slides each cliff in from the viewport edge.
    rockEntries.current = rocks.map((r) => ({
      opacity: 0,
      xOffset: Math.sign(r.cx || -1) * r.w * ROCK_SLIDE_FACTOR,
      yOffset: 0,
    }));

    // Measure the full 8-slot arc path straight off the DOM rotors (hidden, but
    // still laid out): this is both the conveyor path AND each tile's landing
    // slot, so the WebGL necklace matches the DOM collage exactly. cx/cy/size are
    // scaled by TILE_DEPTH so a plane at TILE_Z projects to the measured rect.
    const arc: ConveyorArc = { xs: [], ys: [], sizes: [] };
    const slotPose: TilePose[] = [];
    for (let slot = 0; slot < 8; slot++) {
      const rotor = document.querySelector<HTMLElement>(
        `[data-shot-rotor][data-arc="${slot}"]`,
      );
      if (!rotor) continue;
      const r = rotor.getBoundingClientRect();
      const c = toWorld(r.left + r.width / 2, r.top + r.height / 2);
      const pose = {
        x: c.x * TILE_DEPTH,
        y: c.y * TILE_DEPTH,
        scale: r.width * wpp * TILE_DEPTH,
      };
      arc.xs[slot] = pose.x;
      arc.ys[slot] = pose.y;
      arc.sizes[slot] = pose.scale;
      slotPose[slot] = pose;
    }

    // Tiles: each blooms in at a Figma-scatter spot anchored to the LIVE glass
    // (offsets/sizes scaled by the runtime glass width), then flies onto its arc
    // slot. The hidden return tile (no scatter) is seeded at its slot and only
    // ever moves on the conveyor. Order/identity/arc come from the shared spec.
    const glassScale = glassW / DESIGN_GLASS_W;
    const glassScreenX = heroCx + WELCOME_NUDGE_X;
    const glassScreenY = heroMidY - WELCOME_LIFT;

    const tiles: TileLayout[] = SHOTS.map((shot) => ({
      src: shot.src,
      radiusRatio: shot.radius / shot.size,
      arc: shot.arc,
    }));
    const tileNecklace: TilePose[] = SHOTS.map((shot) => slotPose[shot.arc]);
    const tileScatter: (TilePose | null)[] = SHOTS.map((shot) => {
      if (!shot.scatter) return null;
      // DESIGN_GLASS_DY lifts the offset onto the glass centre (slightly above
      // the frame centre in the design).
      const sx = glassScreenX + shot.scatter.dx * glassScale;
      const sy =
        glassScreenY +
        (shot.scatter.dy - DESIGN_GLASS_DY) * glassScale * TILE_SCATTER_VSCALE;
      const sWorld = toWorld(sx, sy);
      return {
        x: sWorld.x * TILE_DEPTH,
        y: sWorld.y * TILE_DEPTH,
        scale: shot.scatter.size * glassScale * wpp * TILE_DEPTH,
      };
    });

    // Seed: scatter tiles hidden + pre-shrunk for the bloom pop; the return tile
    // parked hidden on its slot (the conveyor takes it from there).
    tileEntries.current = SHOTS.map((_, i) => {
      const sc = tileScatter[i];
      if (sc) return { opacity: 0, x: sc.x, y: sc.y, scale: sc.scale * 0.86 };
      const n = tileNecklace[i];
      return { opacity: 0, x: n.x, y: n.y, scale: n.scale };
    });

    setPlan({
      rocks,
      glassSize,
      welcome,
      navbar,
      tiles,
      tileScatter,
      tileNecklace,
      arc,
    });
  }, [play]);

  // Failsafe: if the scene never signals ready (slow GPU, load hiccup), start
  // anyway so the intro can't hang on a blank sky.
  useEffect(() => {
    if (!play) return;
    const t = window.setTimeout(() => setReady(true), 2500);
    return () => window.clearTimeout(t);
  }, [play]);

  // Wait for the loader's INTRO_GO before running the timeline. Failsafe: if the
  // loader never signals (e.g. it didn't mount), release after its full budget
  // so the welcome can't deadlock the locked, hidden intro.
  useEffect(() => {
    if (!play) return;
    const release = () => setReleased(true);
    window.addEventListener(INTRO_GO_EVENT, release, { once: true });
    const t = window.setTimeout(release, 7000);
    return () => {
      window.removeEventListener(INTRO_GO_EVENT, release);
      window.clearTimeout(t);
    };
  }, [play]);

  // Run the master timeline once the plan is built AND the scene has painted.
  // Scroll locks as soon as we commit to playing (even during the load), but the
  // timeline itself is only built on `ready` so the entrance plays from frame 0.
  useEffect(() => {
    if (!play || !plan) return;

    lenisRef.current?.stop(); // lock now — keep it locked through the load
    if (!ready || !released) {
      // Waiting on the scene to paint AND the loader to hand off; stay locked,
      // release the lock if we unmount before both land.
      return () => {
        lenisRef.current?.start();
      };
    }

    const animObj = anim.current; // stable target for cleanup (ref-safe)
    const rockObjs = rockEntries.current;
    const tileObjs = tileEntries.current;

    // The scene is painted and the entrance is about to play — tell the
    // background clouds to settle in alongside the rock drift (they listen for
    // this and fade up over the same beat, so they're present for the welcome).
    window.dispatchEvent(new Event(INTRO_START_EVENT));

    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      window.dispatchEvent(new Event(INTRO_REVEAL_EVENT));
    };

    const tl = gsap.timeline({
      onComplete: () => {
        lenisRef.current?.start();
        // Don't unmount — drop the glass/rocks (and switch the canvas to the
        // cheap demand loop) so it persists as the steady-state tile scene.
        setIntroActive(false);
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

    // ① reveal — the glass is unmasked in place, rising through its baseline
    //    clip (same expo.out feel as the hero text), and the rocks slide in from
    //    the sides alongside it (each cliff travels in from its own edge + fades
    //    up; left leads right via the stagger). They reach rest (xOffset 0)
    //    before the dock-end crossfade, so the DOM rocks land flush underneath.
    tl.to(
      anim.current,
      { reveal: 1, duration: REVEAL, ease: "expo.out" },
      0,
    );
    tl.to(
      rockObjs,
      {
        opacity: 1,
        xOffset: 0,
        duration: 1.1,
        ease: "power3.out",
        stagger: 0.1,
      },
      0,
    );

    // ①b tiles soft-bloom in place behind the glass (fade + scale pop to their
    //    scatter size), refracting through it. Position stays at scatter; only
    //    opacity + scale move here. They hold through the dock-start, then fly.
    //    The hidden return tile has no scatter and is skipped (it only conveys).
    let bloomIdx = 0;
    plan.tiles.forEach((_, i) => {
      const sc = plan.tileScatter[i];
      if (!sc) return;
      tl.to(
        tileObjs[i],
        { opacity: 1, scale: sc.scale, duration: 0.7, ease: "expo.out" },
        0.1 + bloomIdx * 0.06,
      );
      bloomIdx++;
    });

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

    // ②b tiles fly scatter → necklace along a curved path that bows toward the
    //    docking wordmark (the clasp), then drape into the arc slot — gathering
    //    with the glass, then settling. This rides its own slower duration
    //    (TILE_FLIGHT), so the drape reads gracefully rather than racing the
    //    dock; the conveyor then picks up the instant they land (below).
    const tileFlight = TILE_FLIGHT;
    plan.tiles.forEach((_, i) => {
      const sc = plan.tileScatter[i];
      if (!sc) return; // return tile never flies — it only conveys
      const n = plan.tileNecklace[i];
      // Control point: the straight midpoint pulled toward the wordmark slot.
      const cx = (sc.x + n.x) / 2 + (plan.navbar.x - (sc.x + n.x) / 2) * TILE_GATHER;
      const cy = (sc.y + n.y) / 2 + (plan.navbar.y - (sc.y + n.y) / 2) * TILE_GATHER;
      const d = { t: 0 };
      tl.to(
        d,
        {
          t: 1,
          duration: tileFlight,
          ease: "power2.inOut",
          onUpdate: () => {
            const e = tileObjs[i];
            if (!e) return;
            e.x = quad(sc.x, cx, n.x, d.t);
            e.y = quad(sc.y, cy, n.y, d.t);
            e.scale = sc.scale + (n.scale - sc.scale) * d.t;
          },
        },
        dockStart,
      );
    });

    // Start the steady conveyor the instant the tiles land on the arc, so they
    // flow straight from the fly-in into the rotation without a frozen beat. The
    // fly-in ends exactly on the slot points, which is where the conveyor's p=0
    // sits — seamless.
    tl.call(() => setConveyor(true), undefined, dockStart + tileFlight);

    // ③ cascade the hero in as the glass is nearly landed. This also fires the
    //    DOM-rock crossfade (rock-reveal.tsx), an opacity-only ~0.35s fade — set
    //    early enough that the DOM rocks are SOLID by dockEnd, before the canvas
    //    (carrying the WebGL rocks) starts to fade, so the crossfade never dips
    //    translucent. The DOM rocks land exactly under the WebGL rocks.
    tl.call(reveal, undefined, dockEnd - 0.35);

    // …then fade the glass + WebGL rocks out onto the now-solid DOM rocks and the
    // real DOM wordmark, once the glass has docked. The CANVAS stays opaque (it
    // now hosts the persistent tiles) — so we fade the glass MATERIAL and the
    // rock planes individually rather than the whole wrapper. The tiles, sitting
    // on the arc, stay fully visible through this.
    tl.to(
      anim.current,
      { opacity: 0, duration: 0.4, ease: "power2.out" },
      dockEnd,
    );
    tl.to(
      rockObjs,
      { opacity: 0, duration: 0.4, ease: "power2.out" },
      dockEnd,
    );

    // Hand the glass off to the real DOM wordmark. It's stayed hidden through the
    // whole welcome (HeroReveal skips it on intro handoff); park it in place,
    // invisible, then crossfade it IN exactly as the glass canvas fades OUT — so
    // it reads as glass → solid white text, with no prior text ever showing
    // through the transmissive glass and no competing slide-up.
    const wordmark = document.querySelector<HTMLElement>(
      "[data-wordmark-slot] [data-reveal]",
    );
    if (wordmark) {
      gsap.set(wordmark, { yPercent: 0, y: 0, opacity: 0 });
      tl.to(
        wordmark,
        { opacity: 1, duration: 0.4, ease: "power2.out" },
        dockEnd,
      );
    }

    // Dev hook: ?intropos=P (0..1) freezes the timeline at progress P for a
    // stable inspection frame (no timing races). No failsafe while frozen.
    const posParam = new URLSearchParams(window.location.search).get("intropos");
    if (posParam !== null) {
      tl.progress(Math.min(1, Math.max(0, Number(posParam)))).pause();
      return () => {
        tl.kill();
        gsap.killTweensOf(animObj);
        gsap.killTweensOf(rockObjs);
        gsap.killTweensOf(tileObjs);
        if (wordmark) gsap.killTweensOf(wordmark);
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
      gsap.killTweensOf(tileObjs);
      if (wordmark) gsap.killTweensOf(wordmark);
      lenisRef.current?.start();
    };
  }, [play, plan, ready, released]);

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
        tiles={plan.tiles}
        tileEntry={tileEntries}
        arc={plan.arc}
        introActive={introActive}
        conveyor={conveyor}
        glassSize={plan.glassSize}
        restY={plan.welcome.y}
        onReady={() => setReady(true)}
      />
    </div>
  );
}

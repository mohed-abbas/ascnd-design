"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import ReactDOM from "react-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ROCK_SCALE, UNITS } from "./testimonials-data";
import {
  playTestimonialsReveal,
  resetTestimonialsReveal,
} from "./testimonials-reveal";

// The WebGL canvas is client-only; ssr:false must live in a Client Component.
const RocksCanvas = dynamic(() => import("./testimonial-rocks-canvas"), {
  ssr: false,
});

// WebGL support is static per device — detect once and cache (as CloudLayer).
let webglSupport: boolean | null = null;
function hasWebGL() {
  if (webglSupport !== null) return webglSupport;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    webglSupport = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const SMALL_SCREEN = "(max-width: 768px)";

function subscribe(cb: () => void) {
  const mqs = [window.matchMedia(REDUCE_MOTION), window.matchMedia(SMALL_SCREEN)];
  mqs.forEach((mq) => mq.addEventListener("change", cb));
  return () => mqs.forEach((mq) => mq.removeEventListener("change", cb));
}
function getSnapshot() {
  return (
    hasWebGL() &&
    !window.matchMedia(REDUCE_MOTION).matches &&
    !window.matchMedia(SMALL_SCREEN).matches
  );
}
const noopSubscribe = () => () => {};

/**
 * The rock layer for the testimonials section. When the device can take it
 * (WebGL · not reduced-motion · desktop) it mounts the 3D GLB canvas; otherwise
 * it renders the flat PNG rocks at rest — the same silhouettes, so the fallback
 * is a faithful still of the 3D version. Server + first client render always use
 * the flat fallback (canvas eligibility is unknowable on the server), then swap
 * after hydration — like CloudLayer.
 *
 * ⚠️ Deliberately NOT gated on the quality tier (feature-first, CLAUDE.md): the
 * frame watchdog steps the tier down mid-session under load, and a tier-gated
 * mount SWAPPED the live canvas for the PNG stills while the user was looking at
 * it ("the rocks turned into static images" bug). Eligibility here is static per
 * device; nothing about this layer changes after mount.
 *
 * The 3D canvas is warmed EARLY, not lazily on scroll. Once an eligible device
 * hydrates we idle-preload the chunk + GLB AND mount the canvas (both in the one
 * idle callback below), so the costly first render — WebGL context, GLTF resolve,
 * PMREM bake, shader compile — finishes on a calm main thread long before the
 * user arrives. The canvas is `frameloop="never"`, so once that single warm frame
 * is painted (invisibly, at opacity 0) it renders ZERO frames until the reveal —
 * it idles to zero while mounted, satisfying the heavy-effect contract.
 *
 * ⚠️ Why mount is NOT gated on IntersectionObserver: IO callbacks are spec'd
 * low-priority and get starved during continuous scroll on a heavy page, so a
 * mount gated on IO only fired once you STOPPED scrolling — which is exactly why
 * the rocks used to appear only on scroll-stop while the rings (ScrollTrigger,
 * scroll-frame-synced) revealed on time. Mounting at idle removes that last
 * scroll-timing dependency entirely; the reveal itself is ScrollTrigger-driven.
 */
export default function TestimonialRocks() {
  const eligible = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [inView, setInView] = useState(false);

  // The reveal + in-view gates. ScrollTrigger, NOT IntersectionObserver: IO
  // callbacks are throttled/deferred during continuous scroll, so anything gated
  // on IO only fires once you STOP. ScrollTrigger is evaluated every scroll frame
  // off the shared Lenis→GSAP loop, so it fires mid-scroll — the rocks reveal in
  // lockstep with the rings, no scroll-stop needed. (The canvas MOUNT is warmed
  // at idle, not here — see the idle effect below — so by the time this fires the
  // canvas is already up and the reveal is pure animation.)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    gsap.registerPlugin(ScrollTrigger);
    const section = el.closest<HTMLElement>("[data-testimonials]") ?? el;

    // TWO independent gates on the SECTION — DON'T fold them into one:
    //
    //  • VISIBILITY (pause/resume + reset) — WIDE. The render pump drives the
    //    rocks' orbit + tumble, and it runs the whole time ANY part of the
    //    section is on screen; it only idles once the FULL section has left, and
    //    resumes as it comes back. Leaving completely (either direction) also
    //    RESETS the reveal — rocks re-park off-screen, rings hide — so the
    //    entrance replays on the next pass.
    //
    //  • REVEAL (plays EVERY pass) — fires when the section is ~half in the
    //    viewport, from either direction: "top 50%" going down (section top
    //    crosses the viewport's midline), "bottom 50%" coming back up. The rocks
    //    fly in from beyond the screen edges each time.
    const visibility = ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => setInView(self.isActive),
      onLeave: resetTestimonialsReveal,
      onLeaveBack: resetTestimonialsReveal,
    });
    const reveal = ScrollTrigger.create({
      trigger: section,
      start: "top 50%",
      end: "bottom 50%",
      onEnter: playTestimonialsReveal,
      onEnterBack: playTestimonialsReveal,
    });

    return () => {
      visibility.kill();
      reveal.kill();
    };
  }, []);

  // Deliberately tier-free (see the component doc): eligibility is static per
  // device, so the canvas can never be swapped out from under the user.
  const use3D = hydrated && eligible;

  // Warm the 3D canvas during idle, long before the section is on screen: preload
  // the GLB, then MOUNT the canvas so its costly first render (context, GLTF
  // resolve, PMREM bake, shader compile) happens now, on a calm main thread. The
  // canvas is frameloop="never" and starts at opacity 0, so this is one invisible
  // warm frame then zero frames until the reveal — it idles to zero while mounted.
  // Mounting here (not on a scroll-driven IntersectionObserver) is what removes
  // the scroll-stop dependency: by the time the ScrollTrigger reveal fires, the
  // rocks are already up and only need to fade in. Only eligible 3D devices pay
  // this; the PNG-fallback path never triggers it.
  useEffect(() => {
    if (!use3D) return;
    const run = () => {
      // GLB bytes start downloading in parallel with the chunk parse. Same
      // FileLoader request the canvas makes (same-origin, credentials
      // "same-origin"), so crossOrigin="anonymous" matches and the preload is
      // consumed — not double-fetched (cf. the font preload in layout.tsx).
      ReactDOM.preload("/rocks/testimonial-rock.v1.glb", {
        as: "fetch",
        crossOrigin: "anonymous",
      });
      // ...and the chunk downloads + parses, its module scope firing
      // useGLTF.preload() → the GLB decodes into drei's cache, so the mount
      // resolves synchronously and the warm render is clean. Then mount.
      void import("./testimonial-rocks-canvas");
      setMounted(true);
    };
    // Safari only shipped requestIdleCallback in 16.4 (our floor), but guard
    // anyway and fall back to a short timeout so the preload always fires. The
    // `timeout` is load-bearing: the hero is heavy (clouds, intro glass, GSAP),
    // so idle can be starved for seconds — without a deadline the preload could
    // slip to near-view and lose its whole head start. 2s caps that.
    const ric = window.requestIdleCallback;
    if (typeof ric === "function") {
      const id = ric(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 200);
    return () => window.clearTimeout(id);
  }, [use3D]);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none absolute inset-0"
    >
      {use3D
        ? mounted && (
            // Canvas is oversized + centred on the group box so the rocks can fly
            // in from BEYOND the viewport edges — they start off-screen and ease
            // to their ring. The section's overflow-hidden clips this to the
            // viewport, so a rock is invisible until it crosses the screen edge.
            // Mounted at idle (warm), paused off-screen so it idles to zero.
            <div className="absolute left-1/2 top-1/2 h-[120vh] w-[120vw] -translate-x-1/2 -translate-y-1/2">
              <RocksCanvas paused={!inView} />
            </div>
          )
        : UNITS.map((u, i) => (
            <div
              key={i}
              className="absolute"
              style={{ left: u.cx, top: u.cy }}
            >
              <div
                className="relative"
                style={{
                  width: u.rock.w * ROCK_SCALE,
                  height: u.rock.h * ROCK_SCALE,
                  transform: `translate(-50%, -50%) rotate(${u.rock.rotate}deg)`,
                }}
              >
                <Image
                  src="/rocks/testimonial-rock.png"
                  alt=""
                  fill
                  sizes={`${Math.ceil(u.rock.w * ROCK_SCALE)}px`}
                  className="select-none object-cover"
                />
              </div>
            </div>
          ))}
    </div>
  );
}

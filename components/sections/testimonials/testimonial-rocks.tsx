"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import ReactDOM from "react-dom";
import { useQuality } from "@/lib/perf/use-quality";
import { ROCK_SCALE, UNITS } from "./testimonials-data";

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
 * (WebGL · not reduced-motion · desktop) AND the quality tier allows
 * (`testimonialsDrift`, off on low), it mounts the 3D GLB canvas; otherwise it
 * renders the flat PNG rocks at rest — the same silhouettes, so the fallback is
 * a faithful still of the 3D version. Server + first client render always use
 * the flat fallback (canvas eligibility is unknowable on the server), then swap
 * after hydration — like CloudLayer.
 *
 * The 3D canvas is lazy: it MOUNTS only once the section nears the viewport
 * (IntersectionObserver, expanded margin) and pauses when it scrolls away, so
 * the GPU loop idles off-screen. But mounting is NOT when we start downloading:
 * once an eligible device hydrates we idle-preload the canvas chunk + the GLB
 * (see the effect below) long before near-view, so the mount resolves from
 * cache instead of a cold serial waterfall (chunk → then GLB) racing the user's
 * arrival. Only the *downloads* move earlier; the render still idles off-screen.
 */
export default function TestimonialRocks() {
  const eligible = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const { testimonialsDrift } = useQuality();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [nearView, setNearView] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNearView(true);
        setInView(entry.isIntersecting);
      },
      { rootMargin: "40%" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const use3D = hydrated && eligible && testimonialsDrift;

  // Warm the 3D chunk + GLB during idle, long before near-view, so the canvas
  // mounts from cache instead of cold-loading a serial waterfall (chunk → then
  // GLB) exactly as the user arrives. Only eligible 3D devices pay this; the
  // PNG-fallback path never triggers it. The mount stays near-view gated below,
  // so GPU work still idles off-screen — we move only the *downloads* earlier.
  useEffect(() => {
    if (!use3D) return;
    const run = () => {
      // GLB bytes start downloading in parallel with the chunk parse. Same
      // FileLoader request the canvas later makes (same-origin, credentials
      // "same-origin"), so crossOrigin="anonymous" matches and the preload is
      // consumed — not double-fetched (cf. the font preload in layout.tsx).
      ReactDOM.preload("/rocks/testimonial-rock.v1.glb", {
        as: "fetch",
        crossOrigin: "anonymous",
      });
      // ...and the chunk downloads + parses, its module scope firing
      // useGLTF.preload() → the GLB decodes into drei's cache, so the later
      // near-view mount resolves synchronously and the load-in plays clean.
      void import("./testimonial-rocks-canvas");
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
        ? nearView && (
            <div className="absolute inset-0">
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

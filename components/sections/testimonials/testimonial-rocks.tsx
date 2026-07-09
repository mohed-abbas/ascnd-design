"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
 * The 3D canvas is lazy: it mounts only once the section nears the viewport
 * (IntersectionObserver, expanded margin) and pauses when it scrolls away, so
 * the 8.5 MB model isn't fetched until needed and the loop idles off-screen.
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

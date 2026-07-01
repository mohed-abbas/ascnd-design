"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import {
  trailFragmentShader,
  trailVertexShader,
} from "./cursor-trail-shaders";
import {
  getQualityConfig,
  heavyEffectFpsCap,
  subscribeQuality,
} from "@/lib/perf/quality-store";

/**
 * GPU fluid cursor-trail, ported from `cursor-trail-main/src/main.js`
 * (a standalone Vite + raw-Three demo) into this codebase's conventions.
 *
 * Technique (unchanged from the source): a ping-pong feedback shader. Each
 * frame a full-screen triangle renders into a 1/4-resolution render target,
 * reading the PREVIOUS frame's trail texture (uMap), advecting it along a
 * curl-noise flow field, fading it, and injecting fresh colour at the smoothed
 * pointer. The two render targets swap so the result feeds back in. A second
 * pass draws the trail texture to screen. See docs/cursor-trail.md.
 *
 * Adaptations for this repo (the source did none of these):
 * - Transparent canvas + an alpha = luminance display pass, so the trail reads
 *   as additive glow over the sky (the wrapper sets mix-blend-mode: screen).
 * - Driven off GSAP's shared ticker — NOT a private requestAnimationFrame —
 *   per the "one loop, no competing schedulers" mandate (lenis-provider.tsx).
 * - Idle-gated: the sim only rides the ticker while the pointer is (recently)
 *   moving; it parks after the trail fades so a still cursor costs 0 GPU (the
 *   fragment shader is the heaviest always-on cost on the page — see
 *   docs/performance-audit.md R2). The next pointermove wakes it.
 * - The camera / OrbitControls / tweakpane from the source are dropped: the
 *   shaders write clip-space positions directly, so the camera is unused.
 * - Full teardown on unmount (the source leaked everything).
 */
export default function CursorTrailCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Renderer — transparent so the trail composites over the DOM sky. The
    // ping-pong shaders ignore the camera, but renderer.render() needs one.
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: window.devicePixelRatio < 2,
    });
    renderer.setClearColor(0x000000, 0);
    // R3F-style gotcha: a wrapper class isn't enough — the canvas element
    // itself must be click-through (cloud-canvas.tsx does the same).
    renderer.domElement.style.pointerEvents = "none";
    container.appendChild(renderer.domElement);

    const camera = new THREE.Camera();

    // Shared full-screen triangle (covers the viewport in clip space).
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
        3
      )
    );
    geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2)
    );

    // Display pass: sample the trail texture and emit it with alpha = its
    // luminance, so black (no trail) is transparent and bright trail reads as
    // additive glow once the wrapper's mix-blend-mode: screen is applied.
    const displayMaterial = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTrailMap;
        varying vec2 vUv;
        void main() {
          vec3 color = texture2D(uTrailMap, vUv).rgb;
          // Luminance drives alpha: idle (black) trail is fully transparent.
          float a = dot(color, vec3(0.2126, 0.7152, 0.0722));
          gl_FragColor = vec4(color, a);
        }
      `,
      uniforms: {
        uTrailMap: new THREE.Uniform(null),
      },
      transparent: true,
      depthWrite: false,
    });
    const displayMesh = new THREE.Mesh(geometry, displayMaterial);
    displayMesh.renderOrder = -1;
    const scene = new THREE.Scene();
    scene.add(displayMesh);

    // Half-float ping-pong buffers. Their resolution scale is driven by the
    // adaptive-quality tier (docs/performance-audit.md §6): high 0.5 → low 0.4.
    // Read once here; the subscription below resizes them when the tier steps.
    let rtScale = getQualityConfig().cursorRtScale;
    function createRenderTarget() {
      return new THREE.WebGLRenderTarget(
        sizes.width * rtScale,
        sizes.height * rtScale,
        {
          type: THREE.HalfFloatType,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          depthBuffer: false,
        }
      );
    }
    let inputRT = createRenderTarget();
    let outputRT = createRenderTarget();

    // The trail simulation pass.
    const trailMaterial = new THREE.ShaderMaterial({
      vertexShader: trailVertexShader,
      fragmentShader: trailFragmentShader,
      uniforms: {
        uResolution: new THREE.Uniform(
          new THREE.Vector2(sizes.width * rtScale, sizes.height * rtScale)
        ),
        uMap: new THREE.Uniform(null),
        uPointer: new THREE.Uniform(new THREE.Vector2(0, 0)),
        uDt: new THREE.Uniform(0),
        uSpeed: new THREE.Uniform(0),
        uTime: new THREE.Uniform(0),
      },
    });
    const trailMesh = new THREE.Mesh(geometry, trailMaterial);
    const sceneTrail = new THREE.Scene();
    sceneTrail.add(trailMesh);

    // Pointer in NDC (-1..1, y up), updated on window pointermove.
    const pointer = new THREE.Vector2();
    const onPointerMove = (ev: PointerEvent) => {
      pointer.x = (ev.clientX / sizes.width) * 2 - 1;
      pointer.y = -(ev.clientY / sizes.height) * 2 + 1;
      lastMoveAt = performance.now();
      start(); // wake the sim if it parked while the pointer sat still
    };
    window.addEventListener("pointermove", onPointerMove);

    function applySize() {
      // No camera.updateProjectionMatrix(): the shaders write clip-space
      // positions, so the camera is unused (a bare THREE.Camera has no
      // projection to update).
      trailMaterial.uniforms.uResolution.value.set(
        sizes.width * rtScale,
        sizes.height * rtScale
      );
      renderer.setSize(sizes.width, sizes.height);
      inputRT.setSize(sizes.width * rtScale, sizes.height * rtScale);
      outputRT.setSize(sizes.width * rtScale, sizes.height * rtScale);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    const onResize = () => {
      sizes.width = window.innerWidth;
      sizes.height = window.innerHeight;
      applySize();
    };
    window.addEventListener("resize", onResize);
    applySize();

    let time = 0;
    // Frame-time accumulator for the adaptive fps cap (see below). Accumulating
    // skipped frames' dt keeps the sim integration time-accurate when capped.
    let accumMs = 0;
    let fpsCap = heavyEffectFpsCap();
    // Driven by GSAP's shared ticker. `deltaMs` is ms since the last tick;
    // the source used THREE.Clock.getDelta() (seconds), so divide.
    const update = (_time: number, deltaMs: number) => {
      // Idle-gate: once the pointer has been still long enough for the trail to
      // fully fade, park the loop — a motionless cursor then costs 0 GPU (the
      // sim's fragment shader is the single heaviest always-on cost on the page).
      // onPointerMove re-adds this callback on the next move. IDLE_TIMEOUT covers
      // the trail's ~3s decay, so the frozen last frame is identical to a live
      // one (a still pointer renders the same steady state every frame anyway).
      if (performance.now() - lastMoveAt > IDLE_TIMEOUT_MS) {
        stop();
        return;
      }
      // Adaptive fps cap (docs/performance-audit.md §6): the fluid sim looks
      // identical above 60fps but costs ~2× on a 120Hz panel, so heavyEffectFpsCap
      // caps it there (0 = uncapped, ride the display on a 60Hz high tier). Bail
      // until a full capped interval of frame time has accumulated.
      accumMs += deltaMs;
      if (fpsCap > 0 && accumMs < 1000 / fpsCap) return;
      const dt = accumMs / 1000;
      accumMs = 0;
      time += dt;

      trailMaterial.uniforms.uTime.value = time;
      const prevPointer = trailMaterial.uniforms.uPointer.value as THREE.Vector2;

      // Smoothed pointer speed → blob radius.
      trailMaterial.uniforms.uSpeed.value = THREE.MathUtils.lerp(
        trailMaterial.uniforms.uSpeed.value,
        Math.sqrt(
          (pointer.x - prevPointer.x) ** 2 + (pointer.y - prevPointer.y) ** 2
        ),
        dt * 3
      );

      // Smoothed pointer position → the trailing lag.
      prevPointer.lerp(pointer, dt * 15);
      trailMaterial.uniforms.uDt.value = dt;

      // Pass 1: advance the sim into outputRT (reads the previous frame).
      renderer.setRenderTarget(outputRT);
      renderer.render(sceneTrail, camera);

      // Pass 2: draw the trail texture to screen.
      renderer.setRenderTarget(null);
      displayMaterial.uniforms.uTrailMap.value = outputRT.texture;
      trailMaterial.uniforms.uMap.value = outputRT.texture; // feed back
      renderer.render(scene, camera);

      // Swap the ping-pong buffers.
      const temp = inputRT;
      inputRT = outputRT;
      outputRT = temp;
    };

    // Idle-gate machinery: the sim only rides the shared ticker while the pointer
    // is (recently) moving. Starts parked — the first pointermove wakes it.
    let running = false;
    let lastMoveAt = 0;
    const IDLE_TIMEOUT_MS = 3500; // stillness before parking (covers the trail fade)
    const start = () => {
      if (running) return;
      running = true;
      gsap.ticker.add(update);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      gsap.ticker.remove(update);
    };

    // React to adaptive-quality tier changes (startup pick / watchdog step-down):
    // re-read the fps cap and resize the ping-pong buffers to the new RT scale.
    // On a capable machine the tier stays `high` (== shipped values) and this is
    // a no-op; on a struggling one the watchdog drops rtScale here to recover.
    const onQuality = () => {
      fpsCap = heavyEffectFpsCap();
      const nextScale = getQualityConfig().cursorRtScale;
      if (nextScale !== rtScale) {
        rtScale = nextScale;
        applySize();
      }
    };
    const unsubscribeQuality = subscribeQuality(onQuality);

    return () => {
      unsubscribeQuality();
      gsap.ticker.remove(update);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      inputRT.dispose();
      outputRT.dispose();
      geometry.dispose();
      trailMaterial.dispose();
      displayMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}

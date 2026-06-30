"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import {
  trailFragmentShader,
  trailVertexShader,
} from "./cursor-trail-shaders";

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

    // Two 1/4-resolution half-float render targets — the ping-pong buffers.
    const RT_SCALE = 0.25;
    function createRenderTarget() {
      return new THREE.WebGLRenderTarget(
        sizes.width * RT_SCALE,
        sizes.height * RT_SCALE,
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
          new THREE.Vector2(sizes.width * RT_SCALE, sizes.height * RT_SCALE)
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
    };
    window.addEventListener("pointermove", onPointerMove);

    function applySize() {
      // No camera.updateProjectionMatrix(): the shaders write clip-space
      // positions, so the camera is unused (a bare THREE.Camera has no
      // projection to update).
      trailMaterial.uniforms.uResolution.value.set(
        sizes.width * RT_SCALE,
        sizes.height * RT_SCALE
      );
      renderer.setSize(sizes.width, sizes.height);
      inputRT.setSize(sizes.width * RT_SCALE, sizes.height * RT_SCALE);
      outputRT.setSize(sizes.width * RT_SCALE, sizes.height * RT_SCALE);
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
    // Driven by GSAP's shared ticker. `deltaMs` is ms since the last tick;
    // the source used THREE.Clock.getDelta() (seconds), so divide.
    const update = (_time: number, deltaMs: number) => {
      const dt = deltaMs / 1000;
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

    gsap.ticker.add(update);

    return () => {
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

/**
 * ScrollInput — the one substantive rewrite of the port.
 *
 * The source (`codrops-depth-gallery-main/src/Experience/Scroll.js`) hijacks the
 * global mouse wheel / touch to move the camera through the depth range and runs
 * off its own integration. That can't coexist with this site's Lenis smooth-scroll
 * (it would freeze the page). So this version keeps the source's camera-Z mapping,
 * bounds, and velocity integration EXACTLY, but takes its position from an external
 * scroll progress (0→1) fed by a pinned ScrollTrigger via `setProgress()` — no
 * `wheel`/`touch` listeners, no `preventDefault`, no debug visualizer.
 *
 * Velocity is still derived from the frame-to-frame delta of the smoothed scroll,
 * so every velocity-reactive effect downstream (plane breath, background luminance
 * lift, trail length) behaves as in the original.
 */
import * as THREE from "three";
import type { Gallery } from "./gallery";

class ScrollInput {
  camera: THREE.PerspectiveCamera;
  gallery: Gallery;
  isInitialized: boolean;

  // External progress (0..1) from the pinned ScrollTrigger.
  progress: number;

  // Scroll state
  scrollTarget: number;
  scrollCurrent: number;
  scrollSmoothing: number;
  scrollToWorldFactor: number;
  previousScrollCurrent: number;

  // Velocity
  rawVelocity: number;
  velocity: number;
  velocityDamping: number;
  velocityMax: number;
  velocityStopThreshold: number;

  // Bounds
  useScrollBounds: boolean;
  firstPlaneViewOffset: number;
  lastPlaneViewOffset: number;
  minCameraZ: number;
  maxCameraZ: number;
  cameraStartZ: number;

  constructor(camera: THREE.PerspectiveCamera, gallery: Gallery) {
    this.camera = camera;
    this.gallery = gallery;
    this.isInitialized = false;

    this.progress = 0;

    // Scroll state
    this.scrollTarget = 0;
    this.scrollCurrent = 0;
    this.scrollSmoothing = 0.08;
    this.scrollToWorldFactor = 0.01;
    this.previousScrollCurrent = 0;

    // Velocity
    this.rawVelocity = 0;
    this.velocity = 0;
    this.velocityDamping = 0.12;
    this.velocityMax = 1.5;
    this.velocityStopThreshold = 0.0001;

    // Bounds
    this.useScrollBounds = true;
    this.firstPlaneViewOffset = 5;
    this.lastPlaneViewOffset = 5;
    this.minCameraZ = -Infinity;
    this.maxCameraZ = Infinity;
    this.cameraStartZ = this.camera.position.z;
  }

  init() {
    if (this.isInitialized) return;

    this.updateCameraBounds();
    this.cameraStartZ = this.maxCameraZ;
    this.camera.position.z = this.cameraStartZ;
    this.progress = 0;
    this.scrollTarget = 0;
    this.scrollCurrent = 0;
    this.previousScrollCurrent = this.scrollCurrent;
    this.rawVelocity = 0;
    this.velocity = 0;

    this.isInitialized = true;
  }

  /** Fed by the pinned ScrollTrigger's onUpdate (self.progress). */
  setProgress(progress: number) {
    this.progress = THREE.MathUtils.clamp(progress, 0, 1);
  }

  updateCameraBounds() {
    const depthRange = this.gallery.getDepthRange();
    this.maxCameraZ = depthRange.nearestZ + this.firstPlaneViewOffset;
    this.minCameraZ = depthRange.deepestZ + this.lastPlaneViewOffset;

    if (this.minCameraZ > this.maxCameraZ) {
      this.minCameraZ = this.maxCameraZ;
    }
  }

  cameraZFromScroll(scrollAmount: number) {
    return this.cameraStartZ - scrollAmount * this.scrollToWorldFactor;
  }

  scrollFromCameraZ(cameraZ: number) {
    if (this.scrollToWorldFactor === 0) return 0;
    return (this.cameraStartZ - cameraZ) / this.scrollToWorldFactor;
  }

  updateVelocity() {
    this.rawVelocity = this.scrollCurrent - this.previousScrollCurrent;
    this.velocity = THREE.MathUtils.lerp(this.velocity, this.rawVelocity, this.velocityDamping);
    this.velocity = THREE.MathUtils.clamp(this.velocity, -this.velocityMax, this.velocityMax);

    if (Math.abs(this.velocity) < this.velocityStopThreshold) {
      this.velocity = 0;
    }

    this.previousScrollCurrent = this.scrollCurrent;
  }

  update() {
    this.updateCameraBounds();

    const minimumScroll = this.scrollFromCameraZ(this.maxCameraZ);
    const maximumScroll = this.scrollFromCameraZ(this.minCameraZ);

    // Map external progress (0..1) onto the depth scroll range. The internal
    // smoothing (scrollCurrent chasing scrollTarget) is what produces velocity,
    // so the reactive effects survive the switch from wheel input to progress.
    this.scrollTarget = THREE.MathUtils.lerp(minimumScroll, maximumScroll, this.progress);

    this.scrollCurrent = THREE.MathUtils.lerp(
      this.scrollCurrent,
      this.scrollTarget,
      this.scrollSmoothing,
    );

    if (this.useScrollBounds) {
      this.scrollTarget = THREE.MathUtils.clamp(this.scrollTarget, minimumScroll, maximumScroll);
      this.scrollCurrent = THREE.MathUtils.clamp(this.scrollCurrent, minimumScroll, maximumScroll);
    }

    this.updateVelocity();

    const nextCameraZ = this.cameraZFromScroll(this.scrollCurrent);
    if (this.useScrollBounds) {
      this.camera.position.z = THREE.MathUtils.clamp(nextCameraZ, this.minCameraZ, this.maxCameraZ);
      return;
    }

    this.camera.position.z = nextCameraZ;
  }

  dispose() {
    // No listeners to remove — input comes from the ScrollTrigger owned by the
    // React canvas component, which tears it down on unmount.
  }
}

export { ScrollInput };

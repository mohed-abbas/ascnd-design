/**
 * Experience — 1:1 port of `codrops-depth-gallery-main/src/Experience/index.js`.
 *
 * The "world": owns the Gallery, Background, Label, and TrailController and wires
 * their per-frame update (mood blend, depth/velocity motion response, plane
 * crossfade, trail). Ported verbatim; removals: the tweakpane `Debug` and the
 * `updateFrameTextTone()` body-class toggle (that drove the codrops page-header
 * chrome, which isn't ported). The Label receives the section container.
 */
import * as THREE from "three";
import { Gallery } from "./gallery";
import { Background } from "./background";
import { Label } from "./label";
import { TrailController } from "./trail-controller";
import type { ScrollInput } from "./scroll-input";

class Experience {
  isInitialized: boolean;
  isDisposed: boolean;
  gallery: Gallery;
  label: Label;
  background: Background;
  trailController: TrailController;

  constructor(container: HTMLElement) {
    this.isInitialized = false;
    this.isDisposed = false;
    this.gallery = new Gallery();
    this.label = new Label(this.gallery, container);
    this.background = new Background();
    this.trailController = new TrailController({ gallery: this.gallery });
  }

  async init(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    if (this.isInitialized) return;

    await this.gallery.init(scene);
    this.label.init();
    this.background.init();
    this.trailController.init(scene, camera);

    this.isInitialized = true;
  }

  update(time: number, camera: THREE.PerspectiveCamera | null = null, scroll: ScrollInput | null = null) {
    this.trailController.update(camera, scroll, time);

    // Gallery + label
    this.gallery.update(camera, scroll);
    this.label.update(camera);

    // Camera-driven updates
    if (camera) {
      // Mood colors
      const moodBlendData = this.gallery.getMoodBlendData(camera.position.z);
      if (moodBlendData) {
        this.background.setMoodBlend(moodBlendData);
      }

      // Depth + velocity -> background motion response
      const depthProgress = this.gallery.getDepthProgress(camera.position.z);
      const velocityMax = scroll?.velocityMax || 1;
      const velocityIntensity = THREE.MathUtils.clamp(
        Math.abs(scroll?.velocity || 0) / Math.max(velocityMax, 0.0001),
        0,
        1,
      );
      const planeBlendData = this.gallery.getPlaneBlendData(camera.position.z);
      const blend = planeBlendData?.blend ?? 0;
      const distanceFromBlendCenter = Math.abs(blend - 0.5) * 2;
      const transitionStability = THREE.MathUtils.smoothstep(distanceFromBlendCenter, 0.35, 1);
      const stabilizedVelocityIntensity = velocityIntensity * transitionStability;

      this.background.setMotionResponse({
        depthProgress,
        velocityIntensity: stabilizedVelocityIntensity,
      });
    }

    // Background tick
    this.background.update(time);
  }

  dispose() {
    if (this.isDisposed) return;

    this.trailController.dispose();
    this.gallery.dispose();
    this.label.dispose();
    this.background.dispose();
    this.isDisposed = true;
  }
}

export { Experience };

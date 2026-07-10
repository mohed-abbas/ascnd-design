/**
 * PortfolioEngine — port of `codrops-depth-gallery-main/src/Experience/Engine.js`.
 *
 * Owns the renderer, camera, scene, scroll mapping, and the two-pass render (mood
 * background quad → clear depth → planes → label). The renderer setup, texture
 * preload, resize, and per-frame render order are carried over verbatim. The two
 * changes that let it live inside this Lenis page:
 *
 *   1. NO private requestAnimationFrame loop. The React canvas component drives
 *      `tick(timeMs)` from the shared `gsap.ticker` ("one loop, no competing
 *      schedulers"). Stats / keydown / debug are removed.
 *   2. Scroll comes from `setProgress()` (a pinned ScrollTrigger), not a global
 *      wheel/touch hijack — see ScrollInput.
 *
 * Everything is scoped to the passed canvas + container element (the section),
 * not `window` / `document.body`, so it behaves as an embedded section.
 */
import * as THREE from "three";
import { Experience } from "./experience";
import { ScrollInput } from "./scroll-input";

class PortfolioEngine {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  experience: Experience;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  scroll: ScrollInput;
  renderer: THREE.WebGLRenderer;
  preloadedTextures: Map<string, THREE.Texture>;
  isInitialized: boolean;

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.canvas = canvas;
    this.container = container;
    this.preloadedTextures = new Map();
    this.isInitialized = false;

    this.experience = new Experience(container);
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 0, 6);

    // Scroll (external-progress rewrite)
    this.scroll = new ScrollInput(this.camera, this.experience.gallery);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
  }

  async init() {
    if (this.isInitialized) return;

    this.preloadedTextures = await this.preloadTextures();
    this.experience.gallery.setPreloadedTextures(this.preloadedTextures);

    await this.experience.init(this.scene, this.camera);
    this.scroll.init();

    this.resize();
    this.experience.gallery.bindPointerEvents(this.canvas);

    this.isInitialized = true;
  }

  resize() {
    const width = this.canvas.clientWidth || window.innerWidth || 1;
    const height = this.canvas.clientHeight || window.innerHeight || 1;
    if (width <= 0 || height <= 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.experience.gallery.updatePlaneScale();
    this.experience.gallery.layoutPlanes();
    this.experience.label.resize();
  }

  async preloadTextures(): Promise<Map<string, THREE.Texture>> {
    const textureSources = this.experience.gallery.getTextureSources();
    if (!textureSources.length) return new Map();

    const textureLoader = new THREE.TextureLoader();
    const loadedTextures = new Map<string, THREE.Texture>();

    await Promise.all(
      textureSources.map(async (textureSource) => {
        try {
          const texture = await textureLoader.loadAsync(textureSource);
          texture.colorSpace = THREE.SRGBColorSpace;
          loadedTextures.set(textureSource, texture);
        } catch (error) {
          console.warn(`Texture failed to load: ${textureSource}`, error);
        }
      }),
    );

    return loadedTextures;
  }

  /** Fed by the pinned ScrollTrigger's onUpdate (self.progress). */
  setProgress(progress: number) {
    this.scroll.setProgress(progress);
  }

  /** One frame. Driven by the shared gsap.ticker; `timeMs` is ms (ticker seconds × 1000). */
  tick(timeMs: number) {
    if (!this.isInitialized) return;

    this.scroll.update();
    this.experience.update(timeMs, this.camera, this.scroll);

    this.renderer.clear(true, true, true);
    this.experience.background.render(this.renderer);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
    this.experience.label.render();
  }

  dispose() {
    this.isInitialized = false;

    this.scroll.dispose();

    this.preloadedTextures.forEach((texture) => {
      texture.dispose();
    });
    this.preloadedTextures.clear();

    this.experience.dispose();
    this.renderer.dispose();
  }
}

export { PortfolioEngine };

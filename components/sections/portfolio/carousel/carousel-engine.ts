/**
 * CarouselEngine — portfolio V3. The base depth idea (image planes stacked in 3D,
 * driven by scroll) but WITHOUT the crossfade/blur: planes stay fully opaque and
 * crisp, occluded by the real depth buffer, and a project leaves frame by moving
 * — never by fading. One engine, three arrangements (`mode`):
 *
 *   • "sweep"     — cards rise from depth to centre; the active one scales up and
 *                   pans OFF to the side (alternating L/R) as the next arrives.
 *   • "punch"     — cards stacked dead-centre; the front flies straight toward and
 *                   past the camera (grows beyond the edges), revealing the next.
 *   • "coverflow" — cards on a horizontal arc; active front-centre + largest,
 *                   neighbours angled back; scroll rotates the arc.
 *
 * Imperative Three.js, like the depth gallery: no private rAF (the canvas drives
 * `tick()` off the shared gsap.ticker), scoped to the section canvas, transparent
 * over the site sky. It idles to zero — once the scrubbed head settles and stops
 * moving, `tick()` stops issuing draws until the next scroll.
 */
import * as THREE from "three";
import { galleryPlaneData, type GalleryPlaneDatum } from "../portfolio-data";

export type CarouselMode = "sweep" | "punch" | "coverflow";

const PLANE_HEIGHT = 2.0;
const PLANE_ASPECT = 3 / 2; // landscape, matches the depth gallery
const CAMERA_Z = 4.2;
const GAP = 2.2; // depth between stacked cards

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const easeInCubic = (t: number) => t * t * t;

interface Placement {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
  visible: boolean;
}

/** Cover-fit a (portrait) texture into the landscape plane — crop, never stretch. */
function applyCoverFit(texture: THREE.Texture, imageAspect: number) {
  if (PLANE_ASPECT > imageAspect) {
    texture.repeat.set(1, imageAspect / PLANE_ASPECT);
  } else {
    texture.repeat.set(PLANE_ASPECT / imageAspect, 1);
  }
  texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2);
  texture.needsUpdate = true;
}

class CarouselEngine {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  mode: CarouselMode;
  onActiveChange?: (index: number) => void;

  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  geometry: THREE.PlaneGeometry;
  planes: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[];
  data: GalleryPlaneDatum[];

  targetHead: number;
  currentHead: number;
  activeIndex: number;
  isInitialized: boolean;
  private primed: boolean;
  private idle: boolean;

  constructor(
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    mode: CarouselMode,
    onActiveChange?: (index: number) => void,
  ) {
    this.canvas = canvas;
    this.container = container;
    this.mode = mode;
    this.onActiveChange = onActiveChange;
    this.data = galleryPlaneData;
    this.planes = [];

    this.targetHead = 0;
    this.currentHead = 0;
    this.activeIndex = 0;
    this.isInitialized = false;
    this.primed = false;
    this.idle = false;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 0, CAMERA_Z);
    this.camera.lookAt(0, 0, 0);

    this.geometry = new THREE.PlaneGeometry(PLANE_HEIGHT * PLANE_ASPECT, PLANE_HEIGHT);

    // alpha + transparent clear so the canvas composites over the site sky.
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
  }

  async init() {
    if (this.isInitialized) return;

    const loader = new THREE.TextureLoader();

    await Promise.all(
      this.data.map(async (datum, index) => {
        let texture: THREE.Texture | null = null;
        try {
          texture = await loader.loadAsync(datum.textureSrc);
          texture.colorSpace = THREE.SRGBColorSpace;
          const image = texture.image as { width?: number; height?: number } | undefined;
          const imageAspect =
            image?.width && image?.height ? image.width / image.height : 1;
          applyCoverFit(texture, imageAspect);
        } catch (error) {
          console.warn(`Carousel texture failed to load: ${datum.textureSrc}`, error);
        }

        // Opaque planes: real depth-buffer occlusion (near covers far), no blend
        // — the whole point of V3 is crisp cards with no fade.
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          color: texture ? 0xffffff : new THREE.Color(datum.fallbackColor),
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(this.geometry, material);
        this.planes[index] = mesh;
        this.scene.add(mesh);
      }),
    );

    this.isInitialized = true;
    this.resize();
  }

  /** Fed by the pinned ScrollTrigger (self.progress 0→1). */
  setProgress(progress: number) {
    this.targetHead = clamp(progress, 0, 1) * Math.max(this.data.length - 1, 0);
    if (!this.primed) {
      this.currentHead = this.targetHead;
      this.primed = true;
    }
    this.idle = false;
  }

  private place(index: number, head: number): Placement {
    const r = index - head; // >0 upcoming (deeper), 0 active, <0 leaving

    if (this.mode === "punch") {
      // Straight line in depth; leaving cards move toward/past the camera and
      // grow via perspective until they clear the frame.
      const z = -r * GAP;
      return {
        x: 0,
        y: 0,
        z,
        rotationY: 0,
        scale: 1,
        visible: z < CAMERA_Z - 0.12 && r > -1.4 && r < 6,
      };
    }

    if (this.mode === "coverflow") {
      const rc = clamp(r, -3, 3);
      const spread = 0.5;
      const radius = 3.6;
      return {
        x: Math.sin(rc * spread) * radius,
        y: 0,
        z: (Math.cos(rc * spread) - 1) * radius - Math.abs(rc) * 0.4,
        rotationY: -clamp(r, -2, 2) * 0.55,
        scale: 1 - Math.min(Math.abs(r), 3) * 0.04,
        visible: Math.abs(r) <= 2.6,
      };
    }

    // "sweep" — centred stack in depth; the active card exits to the side.
    if (r >= 0) {
      return { x: 0, y: 0, z: -r * GAP, rotationY: 0, scale: 1, visible: r < 6 };
    }
    const t = -r; // 0 → leaving
    const e = easeInCubic(clamp(t, 0, 1));
    const direction = index % 2 === 0 ? 1 : -1;
    return {
      x: direction * 5.4 * e,
      y: 0,
      z: t * 0.9,
      rotationY: direction * 0.34 * e,
      scale: 1 + 0.5 * e,
      visible: t < 1.4,
    };
  }

  private arrange() {
    for (let index = 0; index < this.planes.length; index += 1) {
      const mesh = this.planes[index];
      if (!mesh) continue;
      const placement = this.place(index, this.currentHead);
      mesh.visible = placement.visible;
      mesh.position.set(placement.x, placement.y, placement.z);
      mesh.rotation.set(0, placement.rotationY, 0);
      mesh.scale.set(placement.scale, placement.scale, 1);
    }

    const active = clamp(Math.round(this.currentHead), 0, this.data.length - 1);
    if (active !== this.activeIndex) {
      this.activeIndex = active;
      this.onActiveChange?.(active);
    }
  }

  /** One frame. Driven by the shared gsap.ticker; idles once the head settles. */
  tick() {
    if (!this.isInitialized) return;

    const previous = this.currentHead;
    this.currentHead += (this.targetHead - this.currentHead) * 0.12;

    const moved = Math.abs(this.currentHead - previous) > 1e-5;
    const settling = Math.abs(this.targetHead - this.currentHead) > 1e-4;
    if (!moved && !settling) {
      // Head is at rest — render one final frame, then stop repainting.
      if (this.idle) return;
      this.idle = true;
    } else {
      this.idle = false;
    }

    this.arrange();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const width = this.canvas.clientWidth || window.innerWidth || 1;
    const height = this.canvas.clientHeight || window.innerHeight || 1;
    if (width <= 0 || height <= 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.idle = false; // force a repaint at the new size
  }

  dispose() {
    this.isInitialized = false;
    this.planes.forEach((mesh) => {
      mesh.material.map?.dispose();
      mesh.material.dispose();
    });
    this.planes = [];
    this.geometry.dispose();
    this.renderer.dispose();
  }
}

export { CarouselEngine };

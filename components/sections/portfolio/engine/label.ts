/**
 * Label — project-info overlay for the depth gallery.
 *
 * Originally a 1:1 port of the codrops "Atmospheric Depth Gallery" color-spec
 * overlay (left: index + colour name + chip; right: CMYK/RGB/HEX/PMS card).
 * Repurposed for ascnd: a single project card — name, tag pills, and a two-line
 * description — swapped to the plane the camera is nearest. The overlay DOM is
 * appended to the passed-in container (the section) so it lives inside the pinned
 * section and unmounts cleanly.
 */
import type * as THREE from "three";
import type { Gallery } from "./gallery";

interface PlaneLabelData {
  name: string;
  tags: string[];
  description: string;
  color: string;
}

class Label {
  gallery: Gallery;
  container: HTMLElement;

  overlayElement: HTMLElement | null;
  nameElement: HTMLElement | null;
  tagsElement: HTMLElement | null;
  descriptionElement: HTMLElement | null;
  activePlaneIndex: number;

  constructor(gallery: Gallery, container: HTMLElement) {
    this.gallery = gallery;
    this.container = container;

    this.overlayElement = null;
    this.nameElement = null;
    this.tagsElement = null;
    this.descriptionElement = null;
    this.activePlaneIndex = -1;
  }

  createElement() {
    const element = document.createElement("section");
    element.className = "plane-label-overlay";
    element.innerHTML = `
      <article class="plane-label">
        <h3 class="plane-label__name"></h3>
        <ul class="plane-label__tags"></ul>
        <p class="plane-label__desc"></p>
      </article>
    `;

    return {
      element,
      nameElement: element.querySelector<HTMLElement>(".plane-label__name"),
      tagsElement: element.querySelector<HTMLElement>(".plane-label__tags"),
      descriptionElement: element.querySelector<HTMLElement>(".plane-label__desc"),
    };
  }

  init() {
    if (this.overlayElement) return;

    const { element, nameElement, tagsElement, descriptionElement } = this.createElement();

    this.overlayElement = element;
    this.nameElement = nameElement;
    this.tagsElement = tagsElement;
    this.descriptionElement = descriptionElement;
    this.overlayElement.style.opacity = "0";

    this.container.append(this.overlayElement);
  }

  getTargetPlaneIndex(cameraZ: number) {
    const blendData = this.gallery.getPlaneBlendData(cameraZ);
    if (!blendData) return -1;
    return blendData.blend >= 0.5 ? blendData.nextPlaneIndex : blendData.currentPlaneIndex;
  }

  applyPlaneContent(planeIndex: number) {
    const plane = this.gallery.planes[planeIndex];
    if (!plane || this.activePlaneIndex === planeIndex) return;

    const labelData = (plane.userData.label || {}) as Partial<PlaneLabelData>;

    if (this.nameElement) this.nameElement.textContent = labelData.name || "Untitled project";
    if (this.tagsElement) {
      const tags = labelData.tags || [];
      this.tagsElement.replaceChildren(
        ...tags.map((tag) => {
          const tagElement = document.createElement("li");
          tagElement.className = "plane-label__tag";
          tagElement.textContent = tag;
          return tagElement;
        }),
      );
    }
    if (this.descriptionElement) this.descriptionElement.textContent = labelData.description || "";
    if (this.overlayElement) this.overlayElement.style.color = labelData.color || "";

    this.activePlaneIndex = planeIndex;
  }

  resize() {}

  update(camera: THREE.PerspectiveCamera | null = null) {
    if (!camera || !this.overlayElement) return;

    const targetPlaneIndex = this.getTargetPlaneIndex(camera.position.z);
    if (targetPlaneIndex < 0) {
      this.overlayElement.style.opacity = "0";
      return;
    }

    this.applyPlaneContent(targetPlaneIndex);
    this.overlayElement.style.opacity = "1";
  }

  render() {}

  dispose() {
    this.overlayElement?.remove();
    this.overlayElement = null;
    this.nameElement = null;
    this.tagsElement = null;
    this.descriptionElement = null;
    this.activePlaneIndex = -1;
  }
}

export { Label };

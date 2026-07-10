/**
 * Portfolio gallery data — 1:1 port of the Codrops "Atmospheric Depth Gallery"
 * (`codrops-depth-gallery-main/src/data/galleryData.js`).
 *
 * Each entry defines one depth plane: its texture, its resting X spread, and the
 * mood colours (background + two blobs) the GLSL background morphs to as the
 * camera passes it, plus the color-spec label card content. Values are carried
 * over verbatim; only the texture paths change to our `public/portfolio/` assets.
 *
 * These 5 flower plates are 1:1 placeholders — they get swapped for real project
 * imagery in a later pass.
 */

export interface GalleryLabel {
  /** Project name (headline of the overlay card). */
  name: string;
  /** Short tags rendered as pills. */
  tags: string[];
  /** Two-line project blurb. */
  description: string;
  /** Overlay text colour, tuned per plane for contrast over the image. */
  color: string;
}

export interface GalleryPlaneDatum {
  fallbackColor: string;
  accentColor: string;
  textureSrc: string;
  position: { x: number; y: number };
  backgroundColor: string;
  blob1Color: string;
  blob2Color: string;
  label: GalleryLabel;
}

export const galleryPlaneData: GalleryPlaneDatum[] = [
  {
    fallbackColor: "#feca4f",
    accentColor: "#feca4f",
    textureSrc: "/portfolio/flower-01.webp",
    position: { x: -0.9, y: 0 },
    backgroundColor: "#fffaf0",
    blob1Color: "#ffdf94",
    blob2Color: "#fce7c4",
    label: {
      name: "Aurora Commerce",
      tags: ["Branding", "E-commerce"],
      description:
        "A headless storefront rebuilt for speed. Placeholder copy standing in for the real project summary.",
      color: "#ffffff",
    },
  },
  {
    fallbackColor: "#80455a",
    accentColor: "#80455a",
    textureSrc: "/portfolio/flower-02.webp",
    position: { x: 0.8, y: 0 },
    backgroundColor: "#fffaf0",
    blob1Color: "#d29a41",
    blob2Color: "#bb96af",
    label: {
      name: "Meridian Finance",
      tags: ["Product", "Web App"],
      description:
        "A dashboard that makes complex data feel calm. Placeholder copy here until the real write-up lands.",
      color: "#ffffff",
    },
  },
  {
    fallbackColor: "#fa7b71",
    accentColor: "#fa7b71",
    textureSrc: "/portfolio/flower-03.webp",
    position: { x: -0.7, y: 0 },
    backgroundColor: "#5f81ab",
    blob1Color: "#f88b8d",
    blob2Color: "#cfbbdd",
    label: {
      name: "Lumen Health",
      tags: ["Mobile", "Design System"],
      description:
        "A patient app built around clarity and trust. Placeholder copy filling in for the real project details.",
      color: "#ffffff",
    },
  },
  {
    fallbackColor: "#3c72c6",
    accentColor: "#3c72c6",
    textureSrc: "/portfolio/flower-04.webp",
    position: { x: 1, y: 0 },
    backgroundColor: "#5b9bc2",
    blob1Color: "#ffaa00",
    blob2Color: "#00e1ff",
    label: {
      name: "Cobalt Studio",
      tags: ["Identity", "Motion"],
      description:
        "A bold visual identity with kinetic type. Placeholder text describing the work in roughly two lines.",
      color: "#ffffff",
    },
  },
  {
    fallbackColor: "#fdd895",
    accentColor: "#fdd895",
    textureSrc: "/portfolio/flower-05.webp",
    position: { x: -0.7, y: 0 },
    backgroundColor: "#7d936e",
    blob1Color: "#fdd895",
    blob2Color: "#a5b599",
    label: {
      name: "Meadow Labs",
      tags: ["Web", "3D"],
      description:
        "An immersive product site with WebGL scenes. Placeholder copy to be swapped for the real summary.",
      color: "#ffffff",
    },
  },
];

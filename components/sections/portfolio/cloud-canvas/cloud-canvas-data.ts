/**
 * CloudCanvas image set.
 *
 * The globe is fed a flat list of image sources (plus a display name for the
 * focus/hover label later). Order here is the order tiles are laid onto the
 * Fibonacci sphere.
 *
 * The images live in public/portfolio/cloud/ named cloud-01.webp … cloud-NN.webp
 * (sourced from the Figma "Startup" collage, resized to ≤900px and WebP-encoded).
 * To change the set: drop files in that directory named to that pattern (spaces in
 * filenames break the URLs — keep them clean) and update CLOUD_IMAGE_COUNT below.
 */

export interface CloudImage {
  src: string;
  /** Shown in the focus/hover label (added in a later pass). */
  name: string;
}

/** How many cloud-NN.webp files exist in public/portfolio/cloud/. */
const CLOUD_IMAGE_COUNT = 28;

export const cloudImages: CloudImage[] = Array.from({ length: CLOUD_IMAGE_COUNT }, (_, i) => {
  const nn = String(i + 1).padStart(2, "0");
  return {
    src: `/portfolio/cloud/cloud-${nn}.webp`,
    name: `Project ${nn}`,
  };
});

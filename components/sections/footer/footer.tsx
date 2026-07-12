import Image from "next/image";
import FooterReveal from "./footer-reveal";

/**
 * Footer — the closing mountain range (Figma frame 539:466, mountains only).
 *
 * The terminal section: a full-bleed photographic mountain range rises from the
 * bottom of the page. Just the peaks — no wordmark, no mist overlays — as a clean
 * cutout (transparent sky, opaque rock) exported from the design source.
 *
 * Like every other section it stays TRANSPARENT over the shared sky: the cutout's
 * sky is transparent, so the fixed <Background/> (fill → grain) shows through and
 * the live volumetric <CloudLayer/> drifts through the open sky above the peaks.
 *
 * Full-bleed: the range bleeds edge-to-edge (w-full), the image's own aspect ratio
 * sets the section height, and the mountains meet the very bottom of the page.
 *
 * The range fades up on scroll-in (footer-reveal.tsx → the shared blur-rise);
 * markup renders FINISHED (SSR / no-JS / reduced-motion show it in place).
 */
export default function Footer() {
  return (
    <footer data-footer className="relative w-full overflow-hidden">
      {/* Blur-rise on scroll-in (see footer-reveal.tsx). */}
      <FooterReveal />

      {/* Mountain cutout, transparent above the ridgeline so the shared sky +
          clouds show through. Never the LCP (it's the last thing on the page) →
          lazy, off the critical path. `unoptimized` skips Next's re-encode: the
          WebP is already a tuned master. Decorative → empty alt. */}
      <Image
        data-footer-scene
        src="/footer/footer-scene.webp"
        alt=""
        aria-hidden
        width={3168}
        height={1344}
        unoptimized
        loading="lazy"
        sizes="100vw"
        className="pointer-events-none block h-auto w-full select-none"
      />
    </footer>
  );
}

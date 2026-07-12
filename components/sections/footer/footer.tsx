import Image from "next/image";
import FooterReveal from "./footer-reveal";
import FooterGlass from "./footer-glass";

/**
 * Footer — the closing mountain range with the live liquid-glass "ascnd" wordmark
 * (Figma frame 539:466), the same glass used in the welcome intro.
 *
 * The scene box is the design's proportion (~1512:1243) so there's sky headroom
 * for the wordmark above the peaks. Two layers stack in it:
 *  - a bottom-anchored mountain <img> — the FALLBACK (SSR / no-JS / mobile /
 *    reduced-motion), a clean cutout with a transparent sky so the shared DOM sky
 *    + live clouds show through above the ridgeline;
 *  - <FooterGlass> — a transparent WebGL overlay (desktop only) that re-draws the
 *    mountains as a plane and lays the refracting glass "ascnd" across the peaks
 *    ("naive Option B": the glass refracts the real, aligned mountains). Its
 *    mountain plane covers the fallback <img>, so eligible devices see the glass
 *    and everyone else still sees the mountains.
 *
 * Full-bleed (w-full); the mountains meet the very bottom of the page. The scene
 * resolves into focus on scroll-in (footer-reveal.tsx → the shared blur-rise).
 */
export default function Footer() {
  return (
    <footer data-footer className="relative w-full overflow-hidden">
      {/* Blur-rise on scroll-in (see footer-reveal.tsx). */}
      <FooterReveal />

      {/* Scene box — design proportion, so the wordmark clears the peaks. */}
      <div data-footer-scene className="relative w-full aspect-[1512/1243]">
        {/* Mountain cutout, bottom-anchored — the fallback layer. Never the LCP
            (last thing on the page) → lazy. `unoptimized` skips Next's re-encode
            (already a tuned master). Decorative → empty alt. */}
        <Image
          src="/footer/footer-scene.webp"
          alt=""
          aria-hidden
          width={3168}
          height={1344}
          unoptimized
          loading="lazy"
          sizes="100vw"
          className="pointer-events-none absolute inset-x-0 bottom-0 block h-auto w-full select-none"
        />

        {/* Live liquid-glass overlay (desktop/WebGL only). */}
        <FooterGlass />
      </div>
    </footer>
  );
}

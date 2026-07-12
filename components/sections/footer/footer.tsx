import FooterReveal from "./footer-reveal";
import FooterScene from "./footer-scene";

/**
 * Footer — the closing mountain range with the live liquid-glass "ascnd" wordmark
 * (Figma frame 539:466), the same glass used in the welcome intro.
 *
 * The scene box is the design's proportion (~1512:1243) so there's sky headroom
 * for the wordmark above the peaks. What fills it is decided client-side by
 * <FooterScene>: the baked-glass composite image on ineligible devices (SSR / no-JS
 * / mobile / reduced-motion / no-WebGL), or the live WebGL glass over the mountains
 * on eligible desktops (mounted lazily as the footer nears the viewport).
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
        <FooterScene />
      </div>
    </footer>
  );
}

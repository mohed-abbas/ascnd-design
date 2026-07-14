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

      {/* Scene box — design proportion, so the wordmark clears the peaks. The
          in-scene glass reveal scrubs off THIS box's scroll-in (footer-glass-scene
          RevealRig → [data-footer-scene]): the wordmark slides up from behind the
          ridgeline in step with the mountains riding into view.

          Below md the box shortens (1512/900) to trim the tall empty-sky headroom
          the design reserves for clearing desktop-height peaks — on a phone the
          scaled peaks are short, so that band reads as dead space. The composite
          anchors to the bottom (object-bottom in footer-scene) so only excess top
          sky is cropped; the full wordmark + mountains stay, with headroom to
          spare. ≥md keeps the exact design proportion (box aspect = image aspect
          → no crop), so desktop is unchanged. */}
      <div
        data-footer-scene
        // The scene box is aspect-locked, so its height scales with viewport
        // WIDTH — on a 2K/ultrawide monitor the 1243-tall design proportion
        // balloons (2105px at 2560w), and most of that extra is empty sky
        // ABOVE the peaks that you scroll through to reach the mountains. On
        // very wide screens use a shorter proportion (like the mobile crop) so
        // the sky headroom is trimmed while the wordmark still clears the peaks
        // (object-bottom keeps the mountains + wordmark, crops only top sky).
        className="relative w-full aspect-[1512/1243] max-md:aspect-[1512/900] min-[1920px]:aspect-[1512/1040]"
      >
        <FooterScene />
      </div>
    </footer>
  );
}

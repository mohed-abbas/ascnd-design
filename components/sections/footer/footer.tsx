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
    <footer
      data-footer
      // On large screens, CAP the footer's on-screen height and CLIP the scene
      // to its bottom (overflow-hidden + the absolute, bottom-anchored scene box
      // below). The scene keeps its DESIGN aspect so it composes correctly — the
      // mountain plane is sized from the view WIDTH, so widening the box (a
      // shorter aspect / letterbox) would blow the peaks up until they swallow
      // the wordmark. Cropping instead trims only the top sky. The wordmark
      // reveal still completes: its scrub ends at "bottom bottom", and the box
      // bottom is still the page bottom.
      className="relative w-full overflow-hidden min-[1920px]:h-[900px]"
    >
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
        // Keeps the DESIGN aspect at every size (correct scene composition). On
        // large screens it becomes absolute + bottom-anchored inside the capped,
        // overflow-hidden <footer> above, so its full aspect-driven height
        // (2105px at 2560w) hangs off the bottom and the excess TOP sky is
        // clipped — an object-bottom crop, not a re-proportion. The mountains
        // and wordmark (both at the scene's bottom) stay full-size and correct;
        // only the empty upper sky is trimmed.
        className="relative w-full aspect-[1512/1243] max-md:aspect-[1512/900] min-[1920px]:absolute min-[1920px]:inset-x-0 min-[1920px]:bottom-0"
      >
        <FooterScene />
      </div>
    </footer>
  );
}

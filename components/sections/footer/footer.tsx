import Image from "next/image";
import AnchorLink from "@/components/ui/anchor-link";
import BookCallLink from "@/components/ui/book-call-link";
import { InstagramSocial, XSocial } from "@/components/ui/icons";
import { NAV_LINKS } from "@/lib/nav-links";
import FooterReveal from "./footer-reveal";

/**
 * Footer — Figma frame "FooterV4" (746:4738, 1512×797).
 *
 * The closing band of the page: a top utility bar (nav links + social icons over
 * a hairline, then a legal row) sitting high in the frame, a giant "ascnd"
 * wordmark filling the lower half, and two grass-topped rock cutouts overflowing
 * the bottom corners. Like every other section it renders TRANSPARENT over the
 * shared fixed <Background/> (sky fill → grain → clouds) — the Figma mock's own
 * #62abff fill + grain are intentionally NOT reproduced here.
 *
 * SIZING CONTRACT (V4 — supersedes the gutter-tracking FooterFinal layout):
 * everything caps at its Figma size. The content column tracks the viewport
 * with the design's 157px gutters BELOW the 1512 frame width and stops growing
 * at the Figma 1197px above it, so the utility text (fixed 16px) and the
 * wordmark never expand past the design on wide screens. The V4 rocks make
 * this work: they reach ~790px in from each screen edge (vs. the old cropped
 * 476px boxes), so the capped wordmark's ends stay tucked behind the cliffs up
 * to ~2780px-wide viewports.
 *
 * Vertical rhythm is the Figma frame's: the content column is centre-anchored
 * in the 797px band (utility bar ~22% down, wordmark bottom ~78% down), which
 * is why FinalCta above runs a tight bottom padding — it leans on this
 * section's top sky for its closing headroom (see final-cta.tsx).
 *
 * ROCKS (747:438 left / 746:4748 right) — ONE shared 825×1024 RGBA cutout
 * (footer-rock.png, the exact V4 asset) placed twice at its NATURAL aspect
 * (the Figma boxes match the source ratio — no stretch, unlike the old
 * FooterFinal crops). Each box is pixel-mapped to the frame and pinned to its
 * screen edge, overflowing the band (clipped by overflow-hidden) so only the
 * designed crop shows:
 *   • left  — 1248×1549 at frame x−457, y308 (pinned left edge)
 *   • right — 1318×1635 at frame x989,  y45  (x989+w1318 → 795px past the
 *             1512 frame edge, so: right:−795px, pinned right edge)
 * The same source shows different-looking cliffs purely through the clipping.
 * Like the hero cliffs they drop below md (a phone screen can't hold two
 * full-height rocks + the giant wordmark).
 *
 * The wordmark is LIVE TEXT (Product Sans BOLD), not the old SVG export — the
 * vector rendered subtly stretched, and real text stays crisp at any size.
 * Weight verified against the V4 vector's per-letter ink widths: they match
 * our Bold cut within 2–3% (Medium is 5–6% too narrow) — the residual is the
 * design vector being a slightly expanded cut, invisible at this scale.
 * Sizing is metric-derived (fontTools over app/fonts/ProductSans-Bold.woff2)
 * to hit the Figma 1197.04×338 box exactly:
 *   • "ascnd" Bold ink at tracking 0 is 2.653em wide × 0.732em tall; the box
 *     ratio (3.542) needs 2.5924em, so tracking −0.0151em closes the gap
 *     (NOT the navbar Wordmark's −0.03em — too narrow for this box — which is
 *     why ui/wordmark.tsx isn't reused here).
 *   • The column is a CSS container (@container); font-size 100cqw/2.5924 =
 *     38.574cqw makes the ink span the column at every width (461.7px at the
 *     1197 cap → ink height ≈ 338px).
 *   • leading-none's line box still overhangs the ink (hhea ascent 0.96 /
 *     descent −0.253 → baseline at 0.8535em): 0.1375em above the "d", 0.1305em
 *     below the baseline overshoot. Negative em margins trim it so the
 *     column's 43px gap meters to the INK, like the Figma box did.
 * Decorative (aria-hidden): the brand is already named in the page above.
 *
 * The nav entries come from lib/nav-links.ts — the SAME array the floating glass
 * menu renders (ui/navbar.tsx). This bar and that menu are the site's one nav
 * shown twice; as separate literals they drifted (the footer sat on a different
 * order), so they share the list. Each routes through <AnchorLink> (client-side
 * next/link that keeps the shared sky/cloud canvas alive and smooth-scrolls
 * in-page anchors via Lenis) — see nav-links.ts for the per-href behaviour.
 * The LEGAL links below stay LOCAL and stay placeholder <a>s: no privacy/terms
 * pages exist yet (unwired until routing lands, matching the rest of the site),
 * so they're placeholders rather than navigation. The social icons are the
 * shared currentColor glyphs (ui/icons.tsx — same glyphs as the V4 node's 20px
 * frames).
 */
const LEGAL = [
  { label: "privacy policy", href: "#privacy" },
  { label: "terms of payment", href: "#terms" },
];

const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com", Icon: InstagramSocial },
  { label: "X (Twitter)", href: "https://x.com", Icon: XSocial },
];

const ROCK_SRC = "/footer/footer-rock.png";

export default function Footer() {
  return (
    <footer
      data-footer
      // The Figma frame is a fixed 797px band; content is centre-anchored in it
      // (see header). Below md it collapses to padded flow (rocks drop, wordmark
      // scales), so the height goes auto.
      className="relative w-full overflow-hidden h-[797px] max-md:h-auto max-md:py-[80px]"
    >
      {/* Scrubs the wordmark's blur-rise as it scrolls into view; renders
          nothing. */}
      <FooterReveal />

      {/* Content column (746:4749) — centre-anchored in the band. Tracks the
          viewport with the Figma 157px gutters below 1512, CAPS at the Figma
          1197px above it (the V4 sizing contract — see header). Below md it
          drops to static, gutter-padded flow. */}
      <div className="@container absolute left-1/2 top-1/2 flex w-[calc(100%-314px)] max-w-[1197px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[43px] max-md:static max-md:w-[calc(100%-48px)] max-md:translate-x-0 max-md:translate-y-0 max-md:mx-auto max-md:gap-[40px]">
        {/* Utility block (746:4744) — nav row, hairline, legal row. The Figma
            block is 1178px inside the 1197px column, centred. */}
        <div className="flex w-full max-w-[1178px] flex-col gap-[12px] max-md:gap-[20px]">
          {/* Row 1 (746:4721) — nav links (left) + social icons (right). */}
          <div className="flex w-full items-center justify-between max-md:flex-col max-md:gap-[16px]">
            <ul className="flex items-start gap-[13px] whitespace-nowrap text-[16px] text-[#f7f4f0] max-md:flex-wrap max-md:justify-center max-md:gap-x-[18px] max-md:gap-y-[8px]">
              {NAV_LINKS.map(({ label, href, booking }) => {
                // The booking entry routes through <BookCallLink> — same link,
                // but it opens the Cal.com modal off /pricing (lib/nav-links.ts).
                const Link = booking ? BookCallLink : AnchorLink;
                return (
                  <li key={label}>
                    <Link
                      href={href}
                      className="inline-block transition-opacity hover:opacity-70"
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center gap-[7px] text-[#f7f4f0]">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-opacity hover:opacity-70"
                >
                  <Icon className="size-[20px]" />
                </a>
              ))}
            </div>
          </div>

          {/* Hairline (746:4720) — the full-width 0.5px rule between the rows. */}
          <div aria-hidden className="h-px w-full bg-white/50" />

          {/* Row 2 (746:4733) — legal links (left) + copyright (right), Product
              Sans Light. */}
          <div className="flex w-full items-center justify-between whitespace-nowrap text-[16px] font-light max-md:flex-col max-md:gap-[8px]">
            <div className="flex items-start gap-[13px] text-[#f7f4f0]">
              {LEGAL.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="inline-block transition-opacity hover:opacity-70"
                >
                  {label}
                </a>
              ))}
            </div>
            {/* Brand name corrected from the mock's "asnd." typo. */}
            <p className="text-white">ascnd. © 2026 all rights reserved</p>
          </div>
        </div>

        {/* Giant wordmark (746:4717) — live text sized to the Figma 1197×338
            box via font metrics (see header for the derivation of the cqw
            font-size and the ink-trimming margins). text-center: the line box
            is the ADVANCE width (2.671em, side bearings included), slightly
            wider than the ink — centring leaves the ink spanning the column
            with a ~6px optical shift, invisible at this scale.
            FooterReveal drives its blur-rise via [data-footer-wordmark].

            pointer-events-none is LOAD-BEARING, not tidiness. At 38.574cqw
            (~461px) with leading-none this <p>'s box is ~461px tall, while the
            ink-trimming margins (mt -0.1375em ≈ -63px) only pull it UP — a
            negative margin moves the box, it doesn't shrink it. So the box
            overlaps the nav row and the legal row stacked above it and, being
            later in DOM order at the same z, took every click on them. Hovers
            still landed wherever a link's own glyphs won the hit test, which is
            why this read as "sometimes hoverable, never clickable". The element
            is aria-hidden + select-none decoration; it should never take input.
            (Same reason the cliff cutouts below carry it.) */}
        <p
          data-footer-wordmark
          aria-hidden
          className="pointer-events-none w-full whitespace-nowrap text-center font-product font-bold leading-none tracking-[-0.0151em] text-white select-none text-[38.574cqw] mt-[-0.1375em] mb-[-0.1305em]"
        >
          ascnd
        </p>
      </div>

      {/* Rocks (747:438 left / 746:4748 right) — the shared V4 cutout placed
          twice at natural aspect, pixel-mapped to the frame, pinned to the
          screen edges, and clipped by the band's overflow-hidden (see header).
          Rendered AFTER the content so they PAINT ON TOP of the wordmark: the
          giant "ascnd"'s ends tuck behind the cliffs, and as the logo rises
          (FooterReveal) it emerges from behind them (the immersion effect).
          pointer-events-none so they never intercept the nav; dropped below md. */}
      <div className="pointer-events-none absolute left-[-457px] top-[308px] h-[1549px] w-[1248px] select-none max-md:hidden">
        <Image
          src={ROCK_SRC}
          alt=""
          fill
          sizes="1248px"
          className="object-cover"
        />
      </div>
      <div className="pointer-events-none absolute right-[-795px] top-[45px] h-[1635px] w-[1318px] select-none max-md:hidden">
        <Image
          src={ROCK_SRC}
          alt=""
          fill
          sizes="1318px"
          className="object-cover"
        />
      </div>
    </footer>
  );
}

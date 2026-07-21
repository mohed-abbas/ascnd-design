import Image from "next/image";
import { InstagramSocial, XSocial } from "@/components/ui/icons";
import FooterReveal from "./footer-reveal";

/**
 * Footer — Figma frame "FooterFinal" (747:488, 1512×797).
 *
 * The closing band of the page: a top utility bar (nav links + social icons over
 * a hairline, then a legal row) sitting high in the frame, a giant "ascnd"
 * wordmark filling the lower half, and two grass-topped rock cutouts hugging the
 * bottom-left and right edges. Like every other section it renders TRANSPARENT
 * over the shared fixed <Background/> (sky fill → grain → clouds) — the Figma
 * mock's own #62abff fill + grain are intentionally NOT reproduced here.
 *
 * Vertical rhythm is the Figma frame's: the content column is centre-anchored in
 * the 797px band (utility bar ~22% down, wordmark bottom ~78% down), which is why
 * FinalCta above runs a tight bottom padding — it leans on this section's top sky
 * for its closing headroom (see final-cta.tsx).
 *
 * ROCKS (747:510 left / 747:511 right) are pixel-mapped to their Figma boxes:
 *   • left  — 476×489, pinned bottom-left  (frame x0,  y308 → bottom of a 797 band)
 *   • right — 382×752, pinned bottom-right (frame x1130,y45  → bottom of the band)
 * Each source cutout (825×1024 RGBA) is STRETCHED to fill its box (`object-fill`),
 * reproducing Figma's fill scale-mode exactly — the boxes' aspect ratios (0.97 /
 * 0.51) deliberately differ from the source (0.81), so the two cliffs read as the
 * design intends. Like the hero cliffs they drop below md (a phone screen can't
 * hold two full-height rocks + the giant wordmark).
 *
 * The wordmark is the exact Figma vector (ascnd-wordmark.svg, viewBox 1197.04×338,
 * Product Sans Medium) rather than live text — at ~460px glyphs, cross-browser
 * font metrics drift, and the vector guarantees 1:1 with the design. Decorative
 * (aria-hidden): the brand is already named in the page above.
 *
 * Links reuse the navbar's in-page anchors; the social icons are the shared
 * currentColor glyphs (ui/icons.tsx). Actions stay unwired until routing /
 * Cal.com land, matching the rest of the site.
 */
const NAV = [
  { label: "home", href: "/" },
  { label: "pricing", href: "#pricing" },
  { label: "work", href: "#work" },
  { label: "book a call", href: "#book" },
];

const LEGAL = [
  { label: "privacy policy", href: "#privacy" },
  { label: "terms of payment", href: "#terms" },
];

const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com", Icon: InstagramSocial },
  { label: "X (Twitter)", href: "https://x.com", Icon: XSocial },
];

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

      {/* Content column (747:489) — centre-anchored in the band. Its width
          TRACKS THE VIEWPORT with the Figma's 157px side gutters
          (calc(100%-314px)), rather than a fixed 1197px: the rocks are full-bleed
          at the screen edges (below), so a fixed-width wordmark would fall short
          of them on any viewport wider than the 1512 design frame and the "d"/"a"
          would stop tucking behind the cliffs. Gutter-scaling keeps the wordmark
          ends a constant 157px from the edges — inside each cliff's reach — at
          every width, and resolves to EXACTLY the Figma 1197px at 1512. Capped at
          2246px so the (proportionally taller) wordmark can't outgrow the 797px
          band on ultrawide. Below md it drops to static, gutter-padded flow. */}
      <div className="absolute left-1/2 top-1/2 flex w-[calc(100%-314px)] max-w-[2246px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[43px] max-md:static max-md:w-[calc(100%-48px)] max-md:translate-x-0 max-md:translate-y-0 max-md:mx-auto max-md:gap-[40px]">
        {/* Utility block (747:490) — nav row, hairline, legal row. */}
        <div className="flex w-full flex-col gap-[12px] max-md:gap-[20px]">
          {/* Row 1 (747:491) — nav links (left) + social icons (right). */}
          <div className="flex w-full items-center justify-between max-md:flex-col max-md:gap-[16px]">
            <ul className="flex items-start gap-[13px] whitespace-nowrap text-[16px] text-[#f7f4f0] max-md:flex-wrap max-md:justify-center max-md:gap-x-[18px] max-md:gap-y-[8px]">
              {NAV.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="inline-block transition-opacity hover:opacity-70"
                  >
                    {label}
                  </a>
                </li>
              ))}
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

          {/* Hairline (747:503) — the full-width 0.5px rule between the rows. */}
          <div aria-hidden className="h-px w-full bg-white/50" />

          {/* Row 2 (747:504) — legal links (left) + copyright (right), Product
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

        {/* Giant wordmark (747:509) — the exact Figma vector, scaling with the
            column width (intrinsic 1197.04×338 ratio). A raw <img>, not
            next/image: it's a 6KB vector (nothing for Next's raster optimizer to
            do, and SVGs need dangerouslyAllowSVG to pass through it at all), so
            the no-img-element LCP/bandwidth warning doesn't apply here.
            FooterReveal drives its blur-rise via [data-footer-wordmark]. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          data-footer-wordmark
          src="/footer/ascnd-wordmark.svg"
          alt=""
          aria-hidden
          className="block h-auto w-full select-none"
        />
      </div>

      {/* Rocks (747:510 left / 747:511 right) — FULL-BLEED, pinned to the screen
          edges (bottom-left / bottom-right), like the hero cliffs. Rendered AFTER
          the content so they PAINT ON TOP of the wordmark: the giant "ascnd"'s
          ends tuck behind the cliffs, and as the logo rises (FooterReveal) it
          emerges from behind them (the immersion effect). The gutter-scaled
          wordmark above keeps its ends within the cliffs' reach at every width
          (see that comment). Each rock is pixel-mapped to its Figma box; the
          825×1024 source cutout is STRETCHED to the box (Figma fill scale-mode —
          the boxes' aspect ratios differ from the source on purpose).
          pointer-events-none so they never intercept the nav; dropped below md. */}
      <div className="pointer-events-none absolute bottom-0 left-0 h-[489px] w-[476px] select-none max-md:hidden">
        <Image
          src="/footer/footer-rock-left.png"
          alt=""
          fill
          sizes="476px"
          className="object-fill"
        />
      </div>
      <div className="pointer-events-none absolute bottom-0 right-0 h-[752px] w-[382px] select-none max-md:hidden">
        <Image
          src="/footer/footer-rock-right.png"
          alt=""
          fill
          sizes="382px"
          className="object-fill"
        />
      </div>
    </footer>
  );
}

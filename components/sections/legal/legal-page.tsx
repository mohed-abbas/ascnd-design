import type { ReactNode } from "react";
import AnchorLink from "@/components/ui/anchor-link";
import ChromeReveal from "@/components/ui/chrome-reveal";
import Footer from "@/components/sections/footer/footer";
import Navbar from "@/components/ui/navbar";
import Wordmark from "@/components/ui/wordmark";

/**
 * The shared shell + prose primitives for the three legal routes — /terms,
 * /privacy and /refunds.
 *
 * NO FIGMA NODE. Every other section on this site is pixel-mapped to a frame
 * (the comments elsewhere cite node ids); these pages have no design source, so
 * the layout is derived ENTIRELY from the existing tokens and section
 * conventions rather than invented:
 *   • `text-display` / −0.03em tracking / 1.1 leading on the title — the same
 *     heading recipe as comparison, faq, working-with and final-cta.
 *   • `text-body` / 0.02em tracking on the prose — the body recipe from
 *     hero-text and comparison.
 *   • `text-white` set once on the column and inherited, with /70 for the
 *     secondary lines — the site's over-sky ink, same as those sections.
 *   • `py-section` (--gap-section) for the vertical rhythm.
 *   • The hairline is the footer's rule verbatim (`h-px bg-white/50`).
 * Like every section it renders TRANSPARENT over the shared fixed
 * <Background/> from layout.tsx — the sky and clouds show through.
 *
 * The one measurement that isn't a straight token: the top padding is
 * `--gap-section + 80px`. The page's brand mark is ABSOLUTE (top-40px, ~38px
 * tall — see app/terms/page.tsx), so it takes no space in flow and a bare
 * `pt-section` would run the title up under it on a short viewport. The 80px is
 * that mark's occupied band; the rhythm token still does the actual spacing.
 *
 * WIDTH: the column caps at 720px, NOT the footer's 1197px. That cap is a
 * measure decision — ~90 characters at the 16px body size — and it is the
 * reason these pages are readable as continuous prose. The rest of the site
 * caps wide because it lays out cards and matrices, not paragraphs.
 *
 * NO SCROLL REVEAL on the prose. The other sections animate because a Figma
 * frame calls for it; a legal page is a document, and blur-rising fifteen
 * sections of contract text as the reader scrolls would fight the one job the
 * page has. The page CHROME still animates in — see <ChromeReveal/> below.
 *
 * WHOLE-PAGE, not just the prose column: this renders the chrome (<ChromeReveal/>,
 * <Navbar/>, the top-center wordmark, <Footer/>) as well, so the three routes
 * under app/ are a metadata export plus one line. /pricing spells the same
 * chrome out inline because it's a one-off; triplicating it across the legal
 * routes is how those three drift apart.
 */
export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  /** Rendered as "last updated {lastUpdated}" — pass LEGAL_DETAILS.lastUpdated. */
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <>
      {/* Fades the navbar in + slides the wordmark up on load. Renders nothing.
          REQUIRED on every non-home route: the shared layout arms
          `.reveal-armed` on <html> for all routes and globals.css hides the
          armed chrome, so without this driver the navbar never appears (see
          chrome-reveal.tsx). */}
      <ChromeReveal />

      <Navbar />

      {/* Top-center brand mark, matching /pricing's placement (glyph top 40px,
          ~38px Product Sans). ABSOLUTE, so it takes no space in flow — which is
          what the section's top padding below has to account for. No
          `data-wordmark-slot`: the WebGL welcome intro only ever docks on the
          homepage hero. */}
      <div className="absolute left-1/2 top-[40px] z-10 -translate-x-1/2 text-[38px] max-md:top-[24px]">
        <span className="block overflow-hidden">
          <span className="block" data-reveal>
            <AnchorLink href="/" aria-label="ascnd — home" className="block">
              <Wordmark />
            </AnchorLink>
          </span>
        </span>
      </div>

      <section className="relative w-full pb-section pt-[calc(var(--gap-section)+80px)]">
        <div className="mx-auto flex w-full max-w-[720px] flex-col px-6 text-white">
          <h1 className="text-display font-light leading-[1.1] tracking-[-0.03em]">
            {title}
          </h1>

          <p className="mt-[14px] text-body font-light leading-normal tracking-[0.02em] text-white/70">
            last updated {lastUpdated}
          </p>

          {/* Same hairline the footer's utility bar draws. */}
          <div aria-hidden className="mt-[28px] h-px w-full bg-white/50" />

          {/* The sections. gap, not margins on the children, so a section can be
              added or reordered without carrying its own spacing. */}
          <div className="mt-[44px] flex flex-col gap-[48px] max-md:gap-[40px]">
            {children}
          </div>
        </div>
      </section>

      {/* Closing footer — shared across routes, and the thing that carries the
          links back to the other two legal pages. */}
      <Footer />
    </>
  );
}

/**
 * One numbered or titled block of the document — an <h2> and its prose.
 *
 * `id` is optional and only set where something links INTO the section: the
 * refunds page points at the ToS pause terms, so that one is an anchor target.
 * <AnchorLink> glides to it through Lenis on the same page and lets the App
 * Router land on it across routes.
 */
export function LegalSection({
  id,
  heading,
  children,
}: {
  id?: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      // scroll-mt clears the fixed navbar when a hash lands on this heading —
      // without it the target sits under the glass bar.
      className="flex flex-col gap-[16px] scroll-mt-[120px]"
    >
      <h2 className="text-body-lg font-medium leading-[1.3] tracking-[-0.01em] text-white">
        {heading}
      </h2>
      {children}
    </section>
  );
}

/**
 * A prose paragraph. `leading-[1.7]` rather than the sections' `leading-normal`
 * — those set one or two lines of supporting copy, this sets multi-line
 * paragraphs where the looser measure is what makes them scannable.
 */
export function LegalP({ children }: { children: ReactNode }) {
  return (
    <p className="text-body font-light leading-[1.7] tracking-[0.02em] text-white/90">
      {children}
    </p>
  );
}

/**
 * The bold lead-in used throughout the source documents ("**Turnaround.** Most
 * requests…"). A <strong> inside a LegalP — semantic emphasis, and it keeps the
 * weight bump in one place so every lead-in matches.
 */
export function LegalLead({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-white">{children}</strong>;
}

/**
 * A cross-reference between the legal pages (ToS §6 → /refunds, the refunds
 * page → the ToS pause terms).
 *
 * Routed through <AnchorLink> like every other internal link on the site, so
 * the shared fixed sky/cloud canvas survives the navigation and a same-page
 * hash glides through Lenis instead of jumping. Underlined rather than
 * colour-only: these sit inside body text, and colour alone is not a
 * distinguishing signal (WCAG 1.4.1).
 */
export function LegalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <AnchorLink
      href={href}
      className="text-white underline decoration-white/40 underline-offset-[3px] transition-colors hover:decoration-white"
    >
      {children}
    </AnchorLink>
  );
}

/**
 * An external link — the same treatment, but a plain <a> with the usual
 * new-tab safety, since AnchorLink is for internal routing only.
 */
export function LegalExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="text-white underline decoration-white/40 underline-offset-[3px] transition-colors hover:decoration-white"
    >
      {children}
    </a>
  );
}

/** A bulleted list. Markers are drawn with ::marker via `list-disc`. */
export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-[10px] pl-[22px] text-body font-light leading-[1.7] tracking-[0.02em] text-white/90 marker:text-white/50">
      {children}
    </ul>
  );
}

export function LegalItem({ children }: { children: ReactNode }) {
  return <li className="pl-[4px]">{children}</li>;
}

/**
 * The privacy policy's "why we use it" table (what we use it for / legal basis).
 *
 * A real <table> — it's tabular data and a screen reader should announce it as
 * such. Below md it restyles to stacked blocks rather than scrolling
 * horizontally: two columns of prose in a 320px-wide viewport is unreadable
 * either way, and the site's rule is that content reflows on mobile. The
 * `max-md:block` cascade is what collapses it; the <th>s are visually hidden
 * there because each cell carries its own label.
 */
export function LegalTable({
  columns,
  rows,
}: {
  columns: readonly [string, string];
  rows: readonly (readonly [string, string])[];
}) {
  return (
    <table className="w-full border-collapse text-left text-body font-light leading-[1.6] tracking-[0.02em] text-white/90 max-md:block">
      <thead className="max-md:hidden">
        <tr>
          {columns.map((column) => (
            <th
              key={column}
              scope="col"
              className="border-b border-white/50 pb-[12px] pr-[20px] align-bottom font-medium text-white last:pr-0"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="max-md:block">
        {rows.map(([use, basis]) => (
          <tr
            key={use}
            className="border-b border-white/20 last:border-b-0 max-md:block max-md:border-white/20 max-md:py-[16px] max-md:first:pt-0 max-md:last:pb-0"
          >
            <td className="py-[14px] pr-[20px] align-top max-md:block max-md:py-0 max-md:pr-0 max-md:text-white">
              {use}
            </td>
            <td className="py-[14px] align-top text-white/70 max-md:block max-md:py-0 max-md:pt-[4px]">
              {/* The column header is the only thing naming this value, and it's
                  hidden on mobile — so restate it there. */}
              <span className="hidden max-md:inline">{columns[1]}: </span>
              {basis}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The contact block that closes each document — the brand name over its
 * address lines. Entries are pre-formatted strings; falsy ones are dropped so a
 * page that omits the postal address (the refunds page does) doesn't render a
 * blank line.
 */
export function LegalContact({ lines }: { lines: readonly (string | false)[] }) {
  return (
    <address className="flex flex-col gap-[4px] text-body font-light not-italic leading-[1.7] tracking-[0.02em] text-white/90">
      <span className="font-medium text-white">ascnd</span>
      {lines.filter(Boolean).map((line) => (
        <span key={line as string}>{line}</span>
      ))}
    </address>
  );
}

/**
 * The site's ONE navigation list — the single source for both the floating glass
 * menu (components/ui/navbar.tsx) and the footer's utility bar
 * (components/sections/footer/footer.tsx).
 *
 * These two are the same nav shown twice, and keeping them as separate literals
 * let them drift: the footer sat on a different ORDER than the menu, and the
 * menu carried an "about" entry pointing at a "#about" section that was never
 * built (AnchorLink no-ops on a missing target, so it silently did nothing).
 * One array, imported by both, makes that class of drift impossible.
 *
 * Every entry is rendered through <AnchorLink> (components/ui/anchor-link.tsx),
 * so an href may carry a hash and the click resolves by destination:
 *   • "/"              route — but ON the homepage it's a same-page no-hash
 *                      href, so it glides to the top through Lenis instead of
 *                      navigating (same behaviour as the wordmark).
 *   • "/#work"         Portfolio, id="work", homepage.
 *   • "/pricing"       route.
 *   • "/pricing#book"  BookACall, id="book", /pricing.
 * Both cross-route hashes work from either page (the navbar and footer are
 * shared): a same-page click glides via Lenis, a cross-page click navigates and
 * the App Router lands on the anchor.
 *
 * A hash here MUST match a real element id or the link is a silent no-op, and
 * nothing will warn you — the missing-target case is a deliberate no-op in
 * AnchorLink, not an error. Check the id exists when you add an entry.
 *
 * The footer's LEGAL list stays local to the footer. Those are document links
 * (/terms, /privacy) rather than site navigation, and the glass menu shouldn't
 * render them.
 */

export type NavLink = {
  label: string;
  href: string;
  /**
   * The BOOKING entry. Both consumers render it through <BookCallLink>
   * (components/ui/book-call-link.tsx) instead of a bare <AnchorLink>, because
   * it's the one link whose destination depends on the current route: on
   * /pricing the href below is a same-page hash and glides to that page's
   * calendar, while on every other route it opens the Cal.com booking modal
   * instead (there's no calendar to scroll to). The href stays meaningful in
   * both cases — it's what cmd/middle click and JS-less visitors follow.
   */
  booking?: boolean;
};

export const NAV_LINKS: NavLink[] = [
  { label: "home", href: "/" },
  { label: "work", href: "/#work" },
  { label: "pricing", href: "/pricing" },
  { label: "book a call", href: "/pricing#book", booking: true },
];

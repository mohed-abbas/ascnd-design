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
 * A hash here MUST match a real element id or the link is a silent no-op — that
 * is the deliberate no-target behaviour AnchorLink relies on for the footer's
 * unbuilt legal links, so it will not warn you. The footer's LEGAL list stays
 * local to the footer: those are placeholder anchors for pages that don't exist
 * yet, not navigation.
 */

export type NavLink = { label: string; href: string };

export const NAV_LINKS: NavLink[] = [
  { label: "home", href: "/" },
  { label: "work", href: "/#work" },
  { label: "pricing", href: "/pricing" },
  { label: "book a call", href: "/pricing#book" },
];

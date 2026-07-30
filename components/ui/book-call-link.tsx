"use client";

import type { MouseEvent, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { openBookingModal } from "@/lib/cal/embed";
import AnchorLink from "./anchor-link";

/**
 * The nav/footer "book a call" entry (lib/nav-links.ts, `booking: true`) — the
 * one nav link whose destination depends on which page you're on:
 *
 *   • /pricing — the page carries the calendar itself (book-a-call.tsx,
 *     id="book"), so the click glides down to it. Nothing special happens here:
 *     the entry's href is "/pricing#book", which <AnchorLink> already treats as
 *     a same-page hash and scrolls through Lenis.
 *   • anywhere else (the homepage) — opens the Cal.com booking MODAL, since
 *     there's no calendar on the route to scroll to.
 *
 * STILL A REAL LINK in both cases, deliberately — it lives in a <ul> of nav
 * links and should behave like its siblings. Keeping the href means cmd/middle
 * click still opens /pricing#book in a new tab (AnchorLink lets modified clicks
 * through untouched) and a JS-less visitor still lands on the calendar page.
 * That's also why the modal is opened from an onClick via openBookingModal()
 * rather than with Cal's `data-cal-link` attributes: embed.js never calls
 * preventDefault(), so on an <a> it would open the modal AND navigate.
 *
 * `data-cal-booking` is the marker CalProvider's probe looks for to decide
 * whether to warm embed.js on this route, since this link carries no
 * `data-cal-link` of its own. It's set ONLY on the branch that actually opens
 * the modal, so /pricing (where this is a plain in-page anchor) still reports no
 * modal surfaces and the provider stays a no-op there.
 */
export default function BookCallLink({
  href,
  children,
  className,
  onClick,
  ...rest
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
} & Omit<React.ComponentPropsWithoutRef<"a">, "href" | "onClick" | "ref">) {
  const pathname = usePathname();
  // Only /pricing has the inline calendar to scroll to.
  const hasCalendarOnPage = pathname === "/pricing";

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    // The consumer's own handler first (the navbar closes its menu here), then
    // bail on anything it already handled.
    onClick?.(e);
    if (e.defaultPrevented) return;
    // Let cmd/ctrl/middle click open the href in a new tab as usual.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    // On /pricing, fall through to AnchorLink's same-page hash glide.
    if (hasCalendarOnPage) return;

    e.preventDefault();
    openBookingModal();
  }

  return (
    <AnchorLink
      href={href}
      className={className}
      onClick={handleClick}
      data-cal-booking={hasCalendarOnPage ? undefined : ""}
      {...rest}
    >
      {children}
    </AnchorLink>
  );
}

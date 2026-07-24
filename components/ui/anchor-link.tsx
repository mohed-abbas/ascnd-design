"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLenis } from "lenis/react";
import type { MouseEvent, ReactNode } from "react";

/**
 * Internal navigation link that keeps the shared fixed sky/cloud canvas alive
 * and smooth-scrolls in-page anchors through the one global Lenis instance.
 *
 * Every internal link renders as a `next/link` (client-side navigation — the
 * global <Background/> + <CloudLayer/> persist across routes, exactly the
 * reason the navbar routes with next/link too). On top of that, `href` may
 * carry a hash and the click is handled by destination:
 *
 *   href form          on the SAME page                 on a DIFFERENT page
 *   ─────────────────  ──────────────────────────────   ─────────────────────
 *   "/"  ,  "/pricing"  Lenis scroll to top             next/link navigates
 *   "/#work"           Lenis scroll to #work            navigate, Next lands on #work
 *   "/pricing#book"    Lenis scroll to #book            navigate, Next lands on #book
 *   "#work"            Lenis scroll to #work (or no-op) treated as current page
 *
 * Same-page hashes are intercepted (preventDefault → `lenis.scrollTo`) so they
 * glide with the site's scroll feel instead of the browser's instant jump; a
 * missing target id is a safe no-op (nothing scrolls), which is why the footer's
 * not-yet-built legal links can route through here harmlessly. Cross-route hashes
 * are left to next/link + the App Router, which scrolls to the id after the new
 * route renders. Modifier/non-left clicks fall through to default behaviour so
 * open-in-new-tab still works.
 *
 * `useLenis()` reads the instance from LenisProvider's context (same source as
 * intro.tsx); it can be null before the provider mounts, so every call is
 * guarded with a native-scroll fallback.
 */
function splitHref(href: string): { path: string; hash: string } {
  const i = href.indexOf("#");
  if (i === -1) return { path: href, hash: "" };
  return { path: href.slice(0, i), hash: href.slice(i + 1) };
}

export default function AnchorLink({
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
} & Omit<React.ComponentPropsWithoutRef<"a">, "href" | "onClick">) {
  const pathname = usePathname();
  const lenis = useLenis();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented) return;
    // Let the browser handle open-in-new-tab / new-window intents.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }

    const { path, hash } = splitHref(href);
    const samePage = path === "" || path === pathname;
    // Cross-route: defer to next/link — the App Router scrolls to any hash once
    // the destination renders.
    if (!samePage) return;

    e.preventDefault();

    // Same route, no hash (e.g. "home" while home) → glide to top.
    if (!hash) {
      if (lenis) lenis.scrollTo(0);
      else window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const target = document.getElementById(hash);
    if (!target) return; // no such section yet → no-op
    if (lenis) lenis.scrollTo(target);
    else target.scrollIntoView({ behavior: "smooth" });
    // Reflect the hash for deep-linking without a second native jump; replace
    // (not push) so Back isn't polluted with intra-page hops.
    history.replaceState(null, "", `#${hash}`);
  }

  return (
    <Link href={href} className={className} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}

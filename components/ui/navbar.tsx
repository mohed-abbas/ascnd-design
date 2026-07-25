"use client";

import { useEffect, useId, useRef, useState } from "react";
import gsap from "gsap";
import { setMode } from "@/lib/theme/mode-store";
import { useMode } from "@/lib/theme/use-mode";
import AnchorLink from "./anchor-link";
import BackToTop from "./back-to-top";
import { CloseIcon, InstagramSocial, MenuLines, XSocial } from "./icons";
import Logo from "./logo";
import { MODE_ITEMS } from "./mode-switcher";

type NavLink = { label: string; href: string };

// All links route through <AnchorLink> (client-side next/link that keeps the
// shared sky/cloud canvas alive AND smooth-scrolls in-page anchors through the
// one Lenis instance). A plain <a href="#work"> here was a native instant jump:
// not smooth, and — because the cloud parallax only advances while Lenis drives
// ScrollTrigger — it froze the hero clouds in place at the target section.
// hrefs are cross-route-safe (the navbar shows on / and /pricing):
//   • work → "/#work"            (Portfolio, id="work", home)
//   • pricing → "/pricing"       (route)
//   • book a call → "/pricing#book" (BookACall, id="book", /pricing)
//   • about → "#about"           (no target section yet — a safe no-op until one exists)
const LINKS: NavLink[] = [
  { label: "work", href: "/#work" },
  { label: "pricing", href: "/pricing" },
  { label: "about", href: "#about" },
  { label: "book a call", href: "/pricing#book" },
];

const SOCIALS = [
  { label: "X (Twitter)", href: "https://x.com", Icon: XSocial },
  { label: "Instagram", href: "https://instagram.com", Icon: InstagramSocial },
];

// Expand/collapse motion. There is ONE glass surface: the compact pill *is* the
// menu, and on open it grows into the 406×365 panel — the element really
// resizes (top/right/bottom/left + border-radius), it isn't a separate panel
// revealed behind the pill. The pill's right edge + vertical center are the
// anchor, so it grows leftward and symmetrically up/down.
//   CLOSED = the 52×149 pill footprint inside the 406×365 nav box
//            (right-inset 22, vertically centered → 108 top/bottom; r=61).
//   OPEN   = the full nav box with its 34px corners.
// clip-path is deliberately NOT used (the box must actually get bigger). The
// backdrop-filter lives on this same element — its own resize is fine; a
// clip-path/filter on an *ancestor* would turn it into a backdrop root and kill
// the blur. Open and close are NOT a symmetric reverse: on close the content
// fades out FIRST (fast), then the glass collapses, so the retracting frame
// never strands the links visibly outside it (see the toggle effect).
const CLOSED = { top: 108, right: 22, bottom: 108, left: 332, borderRadius: 61 };
const OPEN = { top: 0, right: 0, bottom: 0, left: 0, borderRadius: 34 };
const DURATION = 0.65;
const EASE = "power2.inOut";
const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";
const MOBILE_MQ = "(max-width: 767px)";

// The mobile pill is a HORIZONTAL capsule, not the desktop vertical one.
const MOBILE_PILL_W = 140;
const MOBILE_PILL_H = 52;

/**
 * The closed pill footprint (inset rect) inside the nav frame, chosen per
 * breakpoint. Desktop: the Figma 52×149 pill centred on the frame's right edge.
 *
 * Below md the frame is BOTTOM-CENTRE anchored (see the <nav> classes) and the
 * pill is a horizontal 140×52 capsule pinned to the frame's BOTTOM edge, centred
 * horizontally. The glass grows UPWARD out of it into the panel (bottom edge
 * fixed, top rises), the mirror of the desktop grow-down-and-left:
 *   • bottom:0 → the pill sits flush with the frame bottom.
 *   • top: frameHeight − 52 → the pill is 52 tall.
 *   • left/right are derived from the MEASURED frame width so the 140px capsule
 *     stays centred no matter how the width cap resolves on a given device.
 * OPEN is the full frame at both breakpoints, so it needs no variant.
 */
function closedState(nav: HTMLElement) {
  if (window.matchMedia(MOBILE_MQ).matches) {
    const side = Math.max(0, (nav.offsetWidth - MOBILE_PILL_W) / 2);
    return {
      top: nav.offsetHeight - MOBILE_PILL_H,
      right: side,
      bottom: 0,
      left: side,
      borderRadius: MOBILE_PILL_H / 2,
    };
  }
  return CLOSED;
}

/**
 * Floating glass navbar from the Figma "Startup" design.
 * One surface that morphs: condensed (52×149 pill) ⇄ expanded (406×365 menu).
 */
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const activeMode = useMode();
  const navRef = useRef<HTMLElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const mounted = useRef(false);
  const panelId = useId();

  // Close on Escape and on click outside.
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Drive the morph from `open`, building a fresh timeline each toggle so open
  // and close can differ. OPEN: the surface grows pill → panel, then the content
  // (heading → links → socials) fades + rises in over the second half — by then
  // the box already covers their positions, so they spawn onto the glass rather
  // than floating in empty space. CLOSE is deliberately NOT the reverse: the
  // content fades out FIRST (fast), and the glass only starts collapsing once
  // they're nearly gone — otherwise the frame retracts toward the pill while the
  // links are still visible and strands them outside the glass ("text left
  // behind"). The first render and reduced motion snap to the end state instead.
  useEffect(() => {
    const surface = surfaceRef.current;
    const nav = navRef.current;
    if (!surface || !nav) return;

    const items = nav.querySelectorAll<HTMLElement>("[data-menu-item]");
    const reduce = window.matchMedia(REDUCE_MOTION).matches;

    // No entrance on first mount (or reduced motion): snap to current state.
    if (!mounted.current || reduce) {
      mounted.current = true;
      gsap.set(surface, open ? OPEN : closedState(nav));
      gsap.set(items, { autoAlpha: open ? 1 : 0, y: 0 });
      return;
    }

    tlRef.current?.kill();
    const tl = gsap.timeline();

    if (open) {
      tl.to(surface, { ...OPEN, duration: DURATION, ease: EASE }, 0).fromTo(
        items,
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out", stagger: 0.06 },
        0.3,
      );
    } else {
      // Content leaves first; the glass starts shrinking only once it's mostly
      // gone, so the links are never stranded outside the retracting frame.
      tl.to(items, {
        autoAlpha: 0,
        y: 10,
        duration: 0.22,
        ease: "power2.in",
        stagger: 0.04,
      }).to(surface, { ...closedState(nav), duration: DURATION, ease: EASE }, 0.14);
    }

    tlRef.current = tl;
    return () => {
      tl.kill();
    };
  }, [open]);

  return (
    <>
    <nav
      ref={navRef}
      aria-label="Primary"
      data-reveal-soft
      data-reveal-order={2}
      // Below md the frame re-anchors from centre-right (top-62.4%, -translate-y-1/2)
      // to the BOTTOM-CENTRE (left-1/2, bottom-5, -translate-x-1/2): the one mobile
      // pill sits above the thumb, clear of the hero content, and the glass grows
      // UPWARD out of it (see closedState). The mobile frame is taller (h-420) to
      // hold the two-column open panel (nav links | theme column) over the bottom
      // toggle bar. Desktop unchanged — max-md: only.
      className="font-product pointer-events-none fixed right-[33px] top-[62.4%] z-[999] h-[365px] w-[406px] max-w-[calc(100vw-3rem)] -translate-y-1/2 max-md:left-1/2 max-md:right-auto max-md:top-auto max-md:bottom-[20px] max-md:h-[420px] max-md:-translate-x-1/2 max-md:translate-y-0"
    >
      {/* The one morphing glass surface. Its closed pill footprint is pinned
          here as the default/no-JS state; GSAP overrides the geometry inline on
          toggle. Same element carries the blur, border and inset glow, so all
          of it grows together. */}
      <div
        ref={surfaceRef}
        aria-hidden
        // Pre-JS closed footprint. GSAP overrides top/right/bottom/left/radius
        // inline on mount + toggle; the max-md values just approximate the
        // bottom-centre pill (140-wide, flush to the frame bottom) so there's no
        // wrong-shaped flash before the first gsap.set lands.
        className="pointer-events-none absolute bottom-[108px] left-[332px] right-[22px] top-[108px] rounded-[61px] border border-white/30 bg-white/10 shadow-[inset_0_0_28.3px_0_rgba(255,255,255,0.25)] backdrop-blur-[10px] max-md:bottom-0 max-md:left-[101px] max-md:right-[101px] max-md:top-[368px] max-md:rounded-[26px]"
      />

      {/* Menu content — fixed in the nav frame (so it never slides as the box
          grows) and clickable only while open. Each block fades + rises in via
          GSAP; `opacity-0` is the pre-JS / no-JS hidden state. */}
      <div
        id={panelId}
        aria-hidden={!open}
        className={`absolute inset-0 text-white ${
          open ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <span
          data-menu-item
          className="absolute left-[28px] top-[30px] text-[31px] font-medium leading-none tracking-[-0.03em] underline decoration-from-font underline-offset-[6px] opacity-0 max-md:top-[28px]"
        >
          menu
        </span>

        {/* Nav links — the left column. Desktop centres them in the frame; below
            md they sit top-left, leaving room to the right for the theme column
            and below for the bottom toggle bar. */}
        <ul className="absolute left-[26px] top-1/2 flex -translate-y-1/2 flex-col gap-[10px] text-[25px] font-light leading-[1.1] tracking-[-0.03em] max-md:top-[84px] max-md:translate-y-0">
          {LINKS.map((link) => (
            <li key={link.label} data-menu-item className="opacity-0">
              <AnchorLink
                href={link.href}
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
                className="inline-block transition-opacity hover:opacity-70"
              >
                {link.label}
              </AnchorLink>
            </li>
          ))}
        </ul>

        {/* Theme column (MOBILE ONLY) — the sky-mode picker folded into the menu
            as a centred column of the four modes, parallel to the nav links, so
            the standalone rail (hidden below md) never adds a second pill. Same
            store as ModeSwitcher; picking a mode does NOT close the menu, so you
            can preview modes with the panel open. Hidden on desktop (`hidden`),
            where the left rail owns this. */}
        <div
          data-menu-item
          role="group"
          aria-label="Sky mode"
          className="absolute right-[28px] top-[80px] hidden flex-col items-center gap-[6px] opacity-0 max-md:flex"
        >
          {MODE_ITEMS.map(({ mode, label, Icon }) => {
            const isActive = mode === activeMode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setMode(mode)}
                aria-label={label}
                aria-pressed={isActive}
                title={label}
                tabIndex={open ? 0 : -1}
                className={`flex size-[36px] items-center justify-center rounded-full transition-colors duration-200 ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                <Icon className="size-[20px]" />
              </button>
            );
          })}
        </div>

        {/* Hairline above the bottom toggle bar (MOBILE ONLY) — separates the
            panel content from the logo/close bar the glass grows out of. */}
        <div
          data-menu-item
          aria-hidden
          className="absolute left-[26px] right-[26px] bottom-[60px] hidden h-px bg-white/20 opacity-0 max-md:block"
        />

        <div
          data-menu-item
          className="absolute left-[26px] top-[310px] flex items-center gap-[7px] opacity-0 max-md:top-[288px]"
        >
          {SOCIALS.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              aria-label={label}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={open ? 0 : -1}
              className="text-white transition-opacity hover:opacity-70"
            >
              <Icon className="size-6" />
            </a>
          ))}
        </div>
      </div>

      {/* Bare toggle — transparent (no glass of its own), pinned to the pill's
          spot (right + vertically centered) and always on top. It rides on the
          glass surface, which supplies the pill look when closed and stays put
          as the surface grows around it. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        // Centred on the frame's right edge on desktop (vertical: logo over the
        // menu-lines). Below md it becomes the horizontal bottom bar the glass
        // grows out of — pinned to the frame's bottom-centre, 140×52, logo LEFT +
        // lines/close RIGHT — and STAYS there while the panel expands above it
        // (matching closedState's bottom-centre pill). max-md: only → desktop
        // unchanged.
        className="pointer-events-auto absolute right-[22px] top-1/2 z-10 flex h-[149px] w-[52px] -translate-y-1/2 flex-col items-center justify-between pb-[22px] pt-[18px] text-white max-md:left-1/2 max-md:right-auto max-md:top-auto max-md:bottom-0 max-md:h-[52px] max-md:w-[140px] max-md:-translate-x-1/2 max-md:translate-y-0 max-md:flex-row max-md:justify-between max-md:gap-0 max-md:px-[26px] max-md:py-0"
      >
        <Logo className="size-[30px]" />
        {open ? (
          <CloseIcon className="size-[13px]" />
        ) : (
          <MenuLines className="h-[7px] w-[17px]" />
        )}
      </button>
    </nav>

    {/* Back-to-top disc, parked directly under the pill (bottom-right corner
        below md, where the pill is bottom-centre). Lives here rather than in
        layout.tsx so it only exists on routes that actually show the navbar,
        and so its placement constants stay next to the pill geometry they're
        derived from. Hidden until the page is scrolled. */}
    <BackToTop />
    </>
  );
}

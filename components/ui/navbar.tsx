"use client";

import { useEffect, useId, useRef, useState } from "react";
import gsap from "gsap";
import { CloseIcon, InstagramSocial, MenuLines, XSocial } from "./icons";
import Logo from "./logo";

type NavLink = { label: string; href: string };

const LINKS: NavLink[] = [
  { label: "work", href: "#work" },
  { label: "pricing", href: "#pricing" },
  { label: "about", href: "#about" },
  { label: "book a call", href: "#book" },
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

/**
 * Floating glass navbar from the Figma "Startup" design.
 * One surface that morphs: condensed (52×149 pill) ⇄ expanded (406×365 menu).
 */
export default function Navbar() {
  const [open, setOpen] = useState(false);
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
      gsap.set(surface, open ? OPEN : CLOSED);
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
      }).to(surface, { ...CLOSED, duration: DURATION, ease: EASE }, 0.14);
    }

    tlRef.current = tl;
    return () => {
      tl.kill();
    };
  }, [open]);

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      data-reveal-soft
      data-reveal-order={2}
      className="font-product pointer-events-none fixed right-[33px] top-[62.4%] z-[999] h-[365px] w-[406px] max-w-[calc(100vw-3rem)] -translate-y-1/2"
    >
      {/* The one morphing glass surface. Its closed pill footprint is pinned
          here as the default/no-JS state; GSAP overrides the geometry inline on
          toggle. Same element carries the blur, border and inset glow, so all
          of it grows together. */}
      <div
        ref={surfaceRef}
        aria-hidden
        className="pointer-events-none absolute bottom-[108px] left-[332px] right-[22px] top-[108px] rounded-[61px] border border-white/30 bg-white/10 shadow-[inset_0_0_28.3px_0_rgba(255,255,255,0.25)] backdrop-blur-[10px]"
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
          className="absolute left-[28px] top-[30px] text-[31px] font-medium leading-none tracking-[-0.03em] underline decoration-from-font underline-offset-[6px] opacity-0"
        >
          menu
        </span>

        <ul className="absolute left-[26px] top-1/2 flex -translate-y-1/2 flex-col gap-[10px] text-[25px] font-light leading-[1.1] tracking-[-0.03em]">
          {LINKS.map((link) => (
            <li key={link.label} data-menu-item className="opacity-0">
              <a
                href={link.href}
                tabIndex={open ? 0 : -1}
                onClick={() => setOpen(false)}
                className="inline-block transition-opacity hover:opacity-70"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div
          data-menu-item
          className="absolute left-[26px] top-[310px] flex items-center gap-[7px] opacity-0"
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
        className="pointer-events-auto absolute right-[22px] top-1/2 z-10 flex h-[149px] w-[52px] -translate-y-1/2 flex-col items-center justify-between pb-[22px] pt-[18px] text-white"
      >
        <Logo className="size-[30px]" />
        {open ? (
          <CloseIcon className="size-[13px]" />
        ) : (
          <MenuLines className="h-[7px] w-[17px]" />
        )}
      </button>
    </nav>
  );
}

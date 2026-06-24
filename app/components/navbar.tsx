"use client";

import { useEffect, useId, useRef, useState } from "react";
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

/**
 * Floating glass navbar from the Figma "Startup" design.
 * Condensed (52×149 pill) ⇄ Expanded (406×365 menu panel), click to toggle.
 */
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
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

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      data-reveal-soft
      data-reveal-order={2}
      className="font-product pointer-events-none fixed right-[33px] top-[62.4%] z-50 h-[365px] w-[406px] max-w-[calc(100vw-3rem)] -translate-y-1/2"
    >
      {/* Expanded menu panel — fills the nav box; the pill sits over its right
          edge, vertically centered, so the panel grows out from the pill
          (Figma node 103:39: panel centered on the pill). Layer order mirrors
          the design: (1) backdrop-blur fill, (2) content, (3) inset-glow. */}
      <div
        id={panelId}
        aria-hidden={!open}
        className={`absolute inset-0 origin-right rounded-[34px] border border-white/30 text-white transition-[opacity,transform] duration-300 ease-out ${
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[34px] bg-white/10 backdrop-blur-[10px]"
        />

        <span className="absolute left-[28px] top-[30px] text-[31px] font-medium leading-none tracking-[-0.03em] underline decoration-from-font underline-offset-[6px]">
          menu
        </span>

        <ul className="absolute left-[26px] top-1/2 flex -translate-y-1/2 flex-col gap-[10px] text-[25px] font-light leading-[1.1] tracking-[-0.03em]">
          {LINKS.map((link) => (
            <li key={link.label}>
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

        <div className="absolute left-[26px] top-[310px] flex items-center gap-[7px]">
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

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_28.3px_0_rgba(255,255,255,0.25)]"
        />
      </div>

      {/* Condensed pill — persistent anchor that toggles the menu. Rests over
          the panel's right edge, vertically centered, and stays put on toggle
          (the panel scales out from it). */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        className="pointer-events-auto absolute right-[22px] top-1/2 z-10 flex h-[149px] w-[52px] -translate-y-1/2 flex-col items-center justify-between rounded-[61px] border border-white/10 bg-white/10 pb-[22px] pt-[18px] text-white backdrop-blur-[5px]"
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

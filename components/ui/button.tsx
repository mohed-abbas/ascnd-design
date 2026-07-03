"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

/**
 * The site's CTA button — factored out of the two hero CTAs (hero-text.tsx,
 * Figma node 103:22). ONE component, two skins via `variant`:
 *   • solid — white gradient fill + dark text, the primary action ("see plans").
 *   • clear — liquid-glass: white border, white/10 fill, backdrop blur ("book a
 *     15-min intro call").
 *
 * Both share the exact same shape (rounded-[32px], px-20/py-7, 16px), so the
 * geometry lives here once and only the SURFACE differs per variant — the reason
 * this is a variant prop and not two separate components.
 *
 * HOVER AURA — the same gold→green→gold glow ring the card buttons use
 * (subscribe/request/receive-media: AURA gradient, blurred glow halo behind the
 * fill + a mask-clipped gradient ring on the edge, both sweeping via a repeating
 * background-position tween on the shared GSAP ticker). Here it's HOVER-GATED and
 * a touch more prominent than the cards (faster sweep, stronger glow). Per the
 * heavy-effect contract it IDLES TO ZERO: the sweep is paused and the layers
 * faded out whenever the pointer isn't on the button, and it rides GSAP's shared
 * ticker (no private rAF). Reduced-motion keeps the static glow on hover but
 * skips the sweep. To layer the glow BEHIND the surface (glow → fill → ring →
 * label, exactly like the cards), the variant paint lives on a `fill` layer, not
 * the root — the root is just the shape + interaction target.
 *
 * Polymorphic: pass `href` to render an <a> (in-page / nav links, as the hero
 * uses); omit it to render a real <button type="button"> for onClick actions.
 * Any extra anchor/button attributes (onClick, aria-*, target, disabled…) pass
 * straight through. `className` is appended to the root. The hero's reveal-clip
 * wrapper (data-reveal-cta) stays in hero-text.tsx — this is just the surface.
 */
export type ButtonVariant = "solid" | "clear";

// The card aura gradient — gold → green → gold (subscribe/request/receive-media).
const AURA = "linear-gradient(90deg, #ffe8b7, #bbfc73, #ffe8b7)";

// Sweep = one full -200% background-position loop. The cards run 2.4s; the hero
// button is "a bit more prominently moving", so it's faster.
const SWEEP_DURATION = 1.4;
// Glow strength on hover — the cards settle at 0.6; nudged up for prominence.
const GLOW_OPACITY = 0.75;

// Shared shape (root) — rounded corners, padding, size, centering. `group` so the
// clear fill can react to hover in CSS; `isolate` so the aura layers stack cleanly
// behind the label. Radius kept here for the focus outline shape.
const SHAPE =
  "group relative isolate inline-flex items-center justify-center rounded-[32px] px-[20px] py-[7px] text-[16px] font-product";

// Per-variant: [root text/transform, fill-layer surface]. The SURFACE (gradient,
// border, glass, shadow) is on the fill layer so the glow can sit behind it.
const VARIANT: Record<ButtonVariant, { root: string; fill: string }> = {
  solid: {
    root: "text-[#263138] transition-transform hover:scale-[1.02]",
    fill: "bg-gradient-to-b from-white to-[#efefef] shadow-[inset_0px_-2px_1px_0px_#f2f2f2,inset_0px_-2px_2px_0px_rgba(0,0,0,0.5)]",
  },
  clear: {
    root: "text-white",
    fill: "border border-solid border-white bg-white/10 backdrop-blur-[2px] transition-colors group-hover:bg-white/20",
  },
};

type Common = {
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
};

type AsAnchor = Common &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & {
    href: string;
  };

type AsButton = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

export type ButtonProps = AsAnchor | AsButton;

export default function Button({
  variant = "solid",
  className,
  children,
  ...props
}: ButtonProps) {
  const rootRef = useRef<HTMLElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const glow = glowRef.current;
    const ring = ringRef.current;
    if (!root || !glow || !ring) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    gsap.set([glow, ring], { autoAlpha: 0, backgroundPosition: "0% 0" });

    // Continuous aura sweep — paused until hover, so nothing animates at rest
    // (idles to zero). Rides GSAP's shared ticker (LenisProvider), no private rAF.
    const sweep = gsap.to([glow, ring], {
      backgroundPosition: "-200% 0",
      duration: SWEEP_DURATION,
      ease: "none",
      repeat: -1,
      paused: true,
    });

    const enter = () => {
      gsap.to(glow, { autoAlpha: GLOW_OPACITY, duration: 0.25, ease: "power2.out" });
      gsap.to(ring, { autoAlpha: 1, duration: 0.25, ease: "power2.out" });
      if (!reduce) sweep.play();
    };
    const leave = () => {
      gsap.to([glow, ring], {
        autoAlpha: 0,
        duration: 0.2,
        ease: "power2.in",
        // pause the sweep once faded out so no per-frame work continues
        onComplete: () => sweep.pause(),
      });
    };

    // mouseenter/leave = hover intent (not touch taps); focus/blur mirrors it for
    // keyboard users.
    root.addEventListener("mouseenter", enter);
    root.addEventListener("mouseleave", leave);
    root.addEventListener("focus", enter);
    root.addEventListener("blur", leave);

    return () => {
      root.removeEventListener("mouseenter", enter);
      root.removeEventListener("mouseleave", leave);
      root.removeEventListener("focus", enter);
      root.removeEventListener("blur", leave);
      sweep.kill();
      gsap.killTweensOf([glow, ring]);
    };
  }, []);

  const v = VARIANT[variant];
  const rootCls = `${SHAPE} ${v.root}${className ? ` ${className}` : ""}`;

  // glow → fill → ring → label (matches the card layering).
  const aura = (
    <>
      {/* blurred glow halo, behind the fill */}
      <span
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute -inset-[3px] rounded-[35px]"
        style={{
          background: AURA,
          backgroundSize: "200% 100%",
          filter: "blur(9px)",
          opacity: 0,
        }}
      />
      {/* the variant surface (fill) */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 rounded-[32px] ${v.fill}`}
      />
      {/* mask-clipped gradient ring on the 3px edge */}
      <span
        ref={ringRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[32px]"
        style={{
          padding: "3px",
          background: AURA,
          backgroundSize: "200% 100%",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          opacity: 0,
        }}
      />
    </>
  );

  if (props.href !== undefined) {
    return (
      <a
        ref={rootRef as React.RefObject<HTMLAnchorElement>}
        className={rootCls}
        {...props}
      >
        {aura}
        <span className="relative">{children}</span>
      </a>
    );
  }

  return (
    <button
      ref={rootRef as React.RefObject<HTMLButtonElement>}
      type="button"
      className={rootCls}
      {...props}
    >
      {aura}
      <span className="relative">{children}</span>
    </button>
  );
}

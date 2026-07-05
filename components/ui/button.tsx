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
 * HOVER AURA — the siri-style rainbow glow ring from demo.html (the "creating
 * your board" ring: a conic rainbow AURA gradient, a blurred glow halo behind the
 * fill + a mask-clipped gradient ring on the edge, both ORBITING the rim via a
 * --aura-angle rotation tween on the shared GSAP ticker). Here it's HOVER-GATED.
 * Per the heavy-effect contract it IDLES TO ZERO: the sweep is paused and the
 * layers
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

// The aura gradient — the siri-style rainbow from demo.html (the "creating your
// board" ring). A CONIC gradient so the colour ORBITS the rim: the angle is
// driven by --aura-angle (degrees, set per-frame by the rotation tween below),
// and the endpoints match (#5ea8ff → #5ea8ff across 360°) so a full revolution
// has no seam. Fallback 0 keeps the SSR/first paint valid before JS.
const AURA =
  "conic-gradient(from calc(var(--aura-angle, 0) * 1deg), #5ea8ff, #a06bff, #ff6ec7, #ff9d5c, #ffe36e, #5ef2c8, #5ea8ff)";

// Seconds per full revolution of the aura around the rim (continuous). Matches
// the demo's 2.6s auraSpin — slow enough to read as a smooth orbit.
const SWEEP_DURATION = 2.6;
// Glow strength on hover — matches the demo's .aura-glow (0.55).
const GLOW_OPACITY = 0.55;

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

    gsap.set([glow, ring], { autoAlpha: 0 });

    // Continuous aura orbit — rotate the conic gradient's angle around the rim by
    // driving --aura-angle 0→360 (inherited by both glow + ring off the root), so
    // the colour travels around the perimeter. Paused until hover, so nothing
    // animates at rest (idles to zero). Rides GSAP's shared ticker (LenisProvider),
    // no private rAF. A proxy object + onUpdate keeps GSAP off CSS-var unit
    // guessing — it just writes the plain number each frame.
    const angle = { v: 0 };
    const sweep = gsap.to(angle, {
      v: 360,
      duration: SWEEP_DURATION,
      ease: "none",
      repeat: -1,
      paused: true,
      onUpdate: () => root.style.setProperty("--aura-angle", String(angle.v)),
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

  // The glow halo differs by variant because the fill's opacity differs:
  //   • solid — opaque white fill occludes the glow, so a filled blurred blob
  //     (-inset-[3px]) only escapes as a soft halo around the edges. Ideal.
  //   • clear — the fill is bg-white/10 (near see-through), so a filled blob
  //     would shine straight through the glass and flood the whole interior.
  //     Instead the glow is MASK-CLIPPED to the perimeter (same ring technique as
  //     the ring layer, a touch wider + blurred), so it reads as a soft glowing
  //     RING hugging the edge, never a filled centre.
  const glowClear = variant === "clear";
  const glowCls = `pointer-events-none absolute ${
    glowClear ? "inset-0 rounded-[32px]" : "-inset-[3px] rounded-[35px]"
  }`;
  const glowStyle: React.CSSProperties = {
    background: AURA,
    opacity: 0,
    ...(glowClear
      ? {
          padding: "5px",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          filter: "blur(6px)",
        }
      : { filter: "blur(9px)" }),
  };

  // glow → fill → ring → label (matches the card layering).
  const aura = (
    <>
      {/* blurred glow — filled halo (solid) or a perimeter ring (clear) */}
      <span ref={glowRef} aria-hidden className={glowCls} style={glowStyle} />
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

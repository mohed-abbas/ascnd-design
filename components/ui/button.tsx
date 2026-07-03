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
 * Polymorphic: pass `href` to render an <a> (in-page / nav links, as the hero
 * uses); omit it to render a real <button type="button"> for onClick actions.
 * Any extra anchor/button attributes (onClick, aria-*, target, disabled…) pass
 * straight through. `className` is appended, so callers can add layout without
 * losing the base skin. The hero's reveal-clip wrapper (data-reveal-cta) stays in
 * hero-text.tsx — this component is just the surface.
 */
export type ButtonVariant = "solid" | "clear";

const BASE =
  "inline-flex items-center justify-center rounded-[32px] px-[20px] py-[7px] text-[16px] font-product";

const VARIANT: Record<ButtonVariant, string> = {
  solid:
    "bg-gradient-to-b from-white to-[#efefef] text-[#263138] shadow-[inset_0px_-2px_1px_0px_#f2f2f2,inset_0px_-2px_2px_0px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.02]",
  clear:
    "border border-solid border-white bg-white/10 text-white backdrop-blur-[2px] transition-colors hover:bg-white/20",
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
  const cls = `${BASE} ${VARIANT[variant]}${className ? ` ${className}` : ""}`;

  if (props.href !== undefined) {
    return (
      <a className={cls} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={cls} {...props}>
      {children}
    </button>
  );
}

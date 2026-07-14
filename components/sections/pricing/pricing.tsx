import type { ReactNode } from "react";
import Button, { type ButtonVariant } from "@/components/ui/button";
import PricingReveal from "./pricing-reveal";
import { CheckMark, ConnectorArrow } from "./pricing-icons";
import { FIXED_SPRINT, SUBSCRIPTION, type Plan } from "./pricing-data";

/**
 * "simple pricing, pause anytime" — the two-tier pricing section (Figma node
 * 469:680). Two frosted-glass plan cards over the shared sky: an anchored
 * `subscription` card (left, with a "most founders start here" badge) and an
 * offset `fixed sprint` card (right, lower), joined by a dashed connector arrow
 * that traces from the badge down into the sprint card.
 *
 * Like the comparison section it sits TRANSPARENT over the global fixed
 * <Background/> (fill → grain → clouds) — the Figma mock's own #62abff fill +
 * grain are intentionally not reproduced here. Layout mirrors comparison's
 * house convention: one centre-anchored block at the Figma frame's px metrics,
 * children pinned by explicit offsets so the badge overlap, card stagger and
 * arrow all land where the design places them.
 *
 * Glass recipe (rounded-[20px] · border-white/30 · from-black/10→to-black/5 ·
 * backdrop-blur) is the site standard (card-shell.tsx / comparison.tsx); blur
 * is allowed because these cards are siblings of the fixed sky layers, never
 * ancestors (CLAUDE.md). CTAs reuse the shared <Button> (solid = white gradient
 * + rainbow hover aura; clear = liquid glass).
 */
export default function Pricing() {
  return (
    <section
      data-pricing
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden py-[20dvh]"
    >
      <div className="flex w-[1146px] flex-col items-center gap-[20px] max-md:w-full max-md:px-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex w-[628px] flex-col items-center gap-[25px] text-center text-white max-md:w-full">
          <h2
            data-pricing-head
            className="text-display font-light leading-[1.1] tracking-[-0.03em]"
          >
            <span>simple pricing, </span>
            <span className="font-instrument">pause</span>
            <span> anytime</span>
          </h2>
          <p
            data-pricing-sub
            className="text-body leading-normal tracking-[0.02em]"
          >
            two ways to work with us. same senior team either way.
          </p>
        </div>

        {/* ── Cards ──────────────────────────────────────────────────────── */}
        <div className="relative h-[772.535px] w-full max-md:h-auto max-md:flex max-md:flex-col max-md:items-center">
          {/* Subscription — anchored plan (node 469:783) */}
          <PlanCard
            data-pricing-card
            plan={SUBSCRIPTION}
            cta="start your subscription"
            ctaVariant="solid"
            className="left-0 top-[79px] backdrop-blur-[2.9px] max-md:mb-[40px]"
            price={
              <p className="min-w-full">
                <span className="text-[61px] leading-[normal] tracking-[-3.05px] max-md:text-[52px]">
                  $5,995
                </span>
                <span className="text-[20px] leading-[normal]"> /mo</span>
              </p>
            }
            priceNote="no contracts. billed monthly, pause whenever."
            priceNoteClassName="w-[264px]"
          />

          {/* "most founders start here" badge — overlaps the card's top edge
              (node 469:820). White gradient pill with the CTA's inset shadow. */}
          <div
            data-pricing-badge
            className="absolute left-[179.5px] top-[66px] flex items-center justify-center rounded-[32px] bg-gradient-to-b from-white to-[#efefef] px-[20px] py-[5px] shadow-[inset_0px_-2px_1px_0px_#f2f2f2,inset_0px_-2px_2px_0px_rgba(0,0,0,0.5)] max-md:relative max-md:order-first max-md:left-auto max-md:top-auto max-md:z-10 max-md:-mb-[13px]"
          >
            <span className="whitespace-nowrap text-[14px] font-light text-[#263138]">
              most founders start here
            </span>
          </div>

          {/* Fixed sprint — offset plan (node 469:822), heavier frost */}
          <PlanCard
            data-pricing-card
            plan={FIXED_SPRINT}
            cta="book a 15-min intro call"
            ctaVariant="clear"
            className="left-[591px] top-[169.54px] backdrop-blur-[9.6px]"
            columnPadY="py-[48px]"
            price={
              <p className="text-center">
                <span className="text-[20px] leading-[normal]">from </span>
                <span className="text-[61px] leading-[normal] tracking-[-3.05px] max-md:text-[52px]">
                  $10,995
                </span>
              </p>
            }
            priceNote="scoped together on the call, quoted before we start."
            priceNoteClassName="w-[307px]"
          />

          {/* Dashed connector — traces from the badge down into the sprint card
              (node 469:855). Decorative; the gradient fades it in from the left. */}
          <ConnectorArrow
            data-pricing-arrow
            className="pointer-events-none absolute left-[539px] top-0 h-[156px] w-[329.5px] max-md:hidden"
          />
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <p
          data-pricing-foot
          className="w-full text-center text-body-lg leading-normal text-white"
        >
          <span className="font-light">
            every plan comes with the same people and the same standard. the only
            variable is how you want to{" "}
          </span>
          <span className="font-instrument">fly.</span>
        </p>

        {/* Custom-scope catch-all — for work that fits neither plan (node
            546:655). 615px, centred; "book a call" is the underlined link,
            pointing at the same #book target the navbar CTA uses. */}
        <p
          data-pricing-foot
          className="w-[615px] max-w-full text-center text-body-lg font-light leading-[normal] text-white"
        >
          got something that doesn&apos;t fit either of these? tell us what
          you&apos;re building and we&apos;ll scope it to you.{" "}
          <a
            href="#book"
            className="font-medium underline decoration-solid [text-underline-position:from-font] transition-opacity hover:opacity-80"
          >
            book a call
          </a>
        </p>
      </div>

      <PricingReveal />
    </section>
  );
}

/**
 * The frosted card + its shared inner column: title → price block → CTA →
 * divider → description + ticked features. Only the price render, CTA and
 * wrapper position/blur vary between the two plans, so those come in as props
 * while the column geometry (408px, centred, gap-30) lives here once.
 *
 * Card height is content-driven: the column's `columnPadY` (+1.5px border)
 * reproduces each Figma frame's breathing room above/below the centred column,
 * replacing the frames' fixed heights. Figma centres each plan's column in a
 * differently-sized card, so the padding differs per plan: subscription's 539px
 * column in a 626px card = 44px (default `py-[42.5px]`, node 458:413); fixed
 * sprint's shorter 504px column in a 603px card = 49.5px (`py-[48px]`, node
 * 458:582), so the shorter card doesn't read as stubby next to the taller one.
 *
 * Text sits at `leading-[normal]` (CSS auto line-height — what Figma renders),
 * NOT Tailwind's `leading-normal` (1.5): the 1.5 factor inflated every text
 * block (61px price 74→91.5, 16px rows 20→24) and threw the vertical rhythm off.
 */
function PlanCard({
  plan,
  price,
  priceNote,
  priceNoteClassName,
  cta,
  ctaVariant,
  className,
  columnPadY = "py-[42.5px]",
  ...rest
}: {
  plan: Plan;
  price: ReactNode;
  priceNote: string;
  priceNoteClassName?: string;
  cta: string;
  ctaVariant: ButtonVariant;
  className?: string;
  /** Column top/bottom padding — differs per plan to match each Figma card. */
  columnPadY?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`absolute w-[555px] overflow-clip rounded-[20px] border-[1.5px] border-solid border-white/30 bg-gradient-to-b from-black/10 to-black/5 max-md:static max-md:w-full ${className ?? ""}`}
      {...rest}
    >
      <div className={`mx-auto flex w-[408px] flex-col items-center gap-[30px] max-md:w-full max-md:gap-[24px] max-md:px-6 max-md:py-[36px] ${columnPadY}`}>
        <h3 className="font-instrument text-[31px] leading-[normal] text-white">
          {plan.title}
        </h3>

        <div className="flex w-[307px] flex-col items-center gap-[10px] text-center text-white max-md:w-full">
          {price}
          <p className={`text-body font-light leading-[normal] max-md:w-full ${priceNoteClassName ?? ""}`}>
            {priceNote}
          </p>
        </div>

        <Button variant={ctaVariant}>{cta}</Button>

        <div aria-hidden className="h-px w-full bg-white/20" />

        <div className="flex w-[384px] flex-col items-start gap-[20px] max-md:w-full">
          <p className="w-full text-body leading-[normal] text-white">
            {plan.description}
          </p>
          <ul className="flex w-[276px] flex-col items-start gap-[15px] max-md:w-full">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-[7px] max-md:items-start">
                <CheckMark className="size-[20px] shrink-0" />
                <span className="whitespace-nowrap text-body font-light leading-[normal] text-white max-md:whitespace-normal">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

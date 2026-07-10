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
      <div className="flex w-[1146px] flex-col items-center gap-[20px]">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex w-[628px] flex-col items-center gap-[25px] text-center text-white">
          <h2
            data-pricing-head
            className="text-[49px] font-light leading-[1.1] tracking-[-1.47px]"
          >
            <span>simple pricing, </span>
            <span className="font-instrument">pause</span>
            <span> anytime</span>
          </h2>
          <p
            data-pricing-sub
            className="text-[16px] leading-normal tracking-[0.32px]"
          >
            two ways to work with us. same senior team either way.
          </p>
        </div>

        {/* ── Cards ──────────────────────────────────────────────────────── */}
        <div className="relative h-[772.535px] w-full">
          {/* Subscription — anchored plan (node 469:783) */}
          <PlanCard
            data-pricing-card
            plan={SUBSCRIPTION}
            cta="start your subscription"
            ctaVariant="solid"
            className="left-0 top-[79px] backdrop-blur-[2.9px]"
            price={
              <p className="min-w-full">
                <span className="text-[61px] leading-normal tracking-[-3.05px]">
                  $5,995
                </span>
                <span className="text-[20px] leading-normal"> /mo</span>
              </p>
            }
            priceNote="no contracts. billed monthly, pause whenever."
            priceNoteClassName="w-[264px]"
          />

          {/* "most founders start here" badge — overlaps the card's top edge
              (node 469:820). White gradient pill with the CTA's inset shadow. */}
          <div
            data-pricing-badge
            className="absolute left-[179.5px] top-[66px] flex items-center justify-center rounded-[32px] bg-gradient-to-b from-white to-[#efefef] px-[20px] py-[5px] shadow-[inset_0px_-2px_1px_0px_#f2f2f2,inset_0px_-2px_2px_0px_rgba(0,0,0,0.5)]"
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
            price={
              <p className="text-center">
                <span className="text-[20px] leading-normal">from </span>
                <span className="text-[61px] leading-normal tracking-[-3.05px]">
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
            className="pointer-events-none absolute left-[539px] top-0 h-[156px] w-[329.5px]"
          />
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <p
          data-pricing-foot
          className="w-full text-center text-[20px] leading-normal text-white"
        >
          <span className="font-light">
            every plan comes with the same people and the same standard. the only
            variable is how you want to{" "}
          </span>
          <span className="font-instrument">fly.</span>
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
 * Card height is content-driven: the column's `py-[18px]` (+1.5px border =
 * 19.5px visible gap) replaces the Figma frames' fixed heights, which left the
 * two plans with unequal leftover space above/below the centred content
 * (11.5px vs 19.5px). The sprint card keeps its Figma 603px exactly; the
 * subscription card grows 626px → 642px to match the gap.
 */
function PlanCard({
  plan,
  price,
  priceNote,
  priceNoteClassName,
  cta,
  ctaVariant,
  className,
  ...rest
}: {
  plan: Plan;
  price: ReactNode;
  priceNote: string;
  priceNoteClassName?: string;
  cta: string;
  ctaVariant: ButtonVariant;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`absolute w-[555px] overflow-clip rounded-[20px] border-[1.5px] border-solid border-white/30 bg-gradient-to-b from-black/10 to-black/5 ${className ?? ""}`}
      {...rest}
    >
      <div className="mx-auto flex w-[408px] flex-col items-center gap-[30px] py-[18px]">
        <h3 className="font-instrument text-[31px] text-white">{plan.title}</h3>

        <div className="flex w-[307px] flex-col items-center gap-[10px] text-center text-white">
          {price}
          <p className={`text-[16px] font-light leading-normal ${priceNoteClassName ?? ""}`}>
            {priceNote}
          </p>
        </div>

        <Button variant={ctaVariant}>{cta}</Button>

        <div aria-hidden className="h-px w-full bg-white/20" />

        <div className="flex w-[384px] flex-col items-start gap-[20px]">
          <p className="w-full text-[16px] leading-normal text-white">
            {plan.description}
          </p>
          <ul className="flex w-[276px] flex-col items-start gap-[15px]">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-[7px]">
                <CheckMark className="size-[20px] shrink-0" />
                <span className="whitespace-nowrap text-[16px] font-light leading-normal text-white">
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

import Button, { type ButtonProps } from "@/components/ui/button";
import {
  CAL_BOOKING_CONFIG_JSON,
  CAL_LINK,
  POPUP_NS,
} from "@/lib/cal/embed";

/**
 * The site's booking CTA — the shared <Button> wired to open the Cal.com booking
 * MODAL for the `intro-session` event, so the link, namespace and booker config
 * are configured in exactly one place (lib/cal/embed.ts).
 *
 * HOMEPAGE ONLY, deliberately: the hero CTA, the fixed-sprint plan card and the
 * closing CTA. /pricing carries the calendar inline (book-a-call.tsx, id="book")
 * and its booking CTAs scroll DOWN to it instead — a modal over a page already
 * showing the full booker is just a second copy of it. The Pricing section
 * renders on both routes, so it picks per route via its `bookingHref` prop.
 *
 * Purely declarative: the three `data-cal-*` attributes are Cal's documented
 * contract and embed.js's delegated click listener does the opening. That
 * listener resolves the clicked node to the nearest element that `contains()`
 * it, so <Button>'s inner label span is not a problem.
 *
 * Deliberately a real <button> — no `href`. Cal's listener does NOT
 * preventDefault(), so on an <a> the browser would follow the href at the same
 * time as the modal opened. It's also the honest element for "opens a dialog".
 * (These CTAs used to point at `#book`, which only exists on /pricing — on the
 * homepage they were silent no-ops.)
 *
 * `variant` defaults to `clear` (liquid glass), which is what the design uses
 * for every booking CTA; pass `solid` to override.
 *
 * Requires <CalProvider/> mounted at the root (app/layout.tsx) — it loads
 * embed.js and initialises the namespace these attributes name.
 */
export default function BookCallButton({
  variant = "clear",
  ...props
}: Extract<ButtonProps, { href?: undefined }>) {
  return (
    <Button
      variant={variant}
      data-cal-namespace={POPUP_NS}
      data-cal-link={CAL_LINK}
      data-cal-config={CAL_BOOKING_CONFIG_JSON}
      {...props}
    />
  );
}

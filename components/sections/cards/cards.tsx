import CardShell from "./card-shell";
import CardsHeading from "./cards-heading";
import CardsReveal from "./cards-reveal";
import ReceiveMedia from "./receive-media";
import RequestMedia from "./request-media";
import SubscribeMedia from "./subscribe-media";
import { CARD_COPY } from "./cards-data";

/**
 * "AimatedCards" section — Figma frame 220:1418 (1512×982). A centered row of
 * three glass cards (subscribe · request · receive) over the shared sky. Like
 * the hero, it renders at design scale (fixed px, center-anchored) and stays
 * transparent so the fixed <Background/> + clouds show through.
 *
 * Each card's media is a self-contained component so the auto-running infinite
 * animations (cursor drift, request conveyor, shot-grid scroll) can be layered
 * on next without touching the layout.
 */
export default function Cards() {
  return (
    <section
      // `id` (not just the data-attribute) because this is a NAVIGATION target:
      // the hero's "explore more" CTA glides here. data-cards stays the styling/
      // query hook — ids are for anchors, so a link can never depend on one.
      id="cards"
      data-cards
      className="relative min-h-dvh w-full overflow-hidden max-md:flex max-md:flex-col max-md:items-center max-md:gap-[40px] max-md:py-[80px]"
    >
      {/* Section heading (Figma 302:1446): "ground to launch in days" — floats
          303px above the card-row centre. Client component: it blur-reveals word
          by word on scroll-in (see cards-heading.tsx). Below md it un-pins to the
          top of the stack (see cards-heading.tsx). */}
      <CardsHeading />

      {/* Client driver: blur-reveals each glass card (shell + title + media) as
          the row scrolls in, left→right (see cards-reveal.tsx). Renders nothing. */}
      <CardsReveal />

      {/*
        Below md the 1360px-wide centred row reflows to a vertical stack, each
        card scaled to fit the phone as ONE unit (media guts + their GSAP
        animations shrink together — the why-stay "scale, don't rebuild" call).
        Each card sits in a [data-card-scale] wrapper: a plain shrink-0 flex item
        on desktop (byte-identical — same 440-wide item the article was), and the
        scale carrier on mobile. The scale/origin/margin live in globals.css
        (keyed off [data-cards-row]/[data-card-scale]) so we get a tan/atan2
        fallback and don't depend on Tailwind emitting an arbitrary transform;
        see the "Card stack scale" block there. Scale rides the WRAPPER, not
        [data-card-shell], so the article's transform stays free for the reveal.
      */}
      <div
        data-cards-row
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-[20px] max-md:static max-md:translate-x-0 max-md:translate-y-0 max-md:flex-col max-md:items-center max-md:gap-[24px]"
      >
        <div data-card-scale className="shrink-0">
          <CardShell title="subscribe" subtitle={CARD_COPY.subscribe}>
            <SubscribeMedia />
          </CardShell>
        </div>
        <div data-card-scale className="shrink-0">
          <CardShell title="request" subtitle={CARD_COPY.request}>
            <RequestMedia />
          </CardShell>
        </div>
        <div data-card-scale className="shrink-0">
          <CardShell title="receive" subtitle={CARD_COPY.receive}>
            <ReceiveMedia />
          </CardShell>
        </div>
      </div>
    </section>
  );
}

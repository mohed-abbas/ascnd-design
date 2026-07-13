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
    <section data-cards className="relative min-h-dvh w-full overflow-hidden">
      {/* Section heading (Figma 302:1446): "ground to launch in days" — floats
          303px above the card-row centre. Client component: it blur-reveals word
          by word on scroll-in (see cards-heading.tsx). */}
      <CardsHeading />

      {/* Client driver: blur-reveals each glass card (shell + title + media) as
          the row scrolls in, left→right (see cards-reveal.tsx). Renders nothing. */}
      <CardsReveal />

      <div
        data-cards-row
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-[20px]"
      >
        <CardShell title="subscribe" subtitle={CARD_COPY.subscribe}>
          <SubscribeMedia />
        </CardShell>
        <CardShell title="request" subtitle={CARD_COPY.request}>
          <RequestMedia />
        </CardShell>
        <CardShell title="receive" subtitle={CARD_COPY.receive}>
          <ReceiveMedia />
        </CardShell>
      </div>
    </section>
  );
}

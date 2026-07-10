/**
 * FAQ content (Figma node 526:414). The design only draws the six collapsed
 * question pills (526:415…526:450) — no answer copy exists in the mock, so the
 * answers are authored here in the site's established voice (lowercase, direct,
 * confident — mirroring pricing-data.ts and working-with.tsx).
 */

export type Faq = {
  /** Question label, exactly as the Figma pill reads (526:416, 526:423, …). */
  readonly question: string;
  /** Answer revealed on expand — authored copy, not from the mock. */
  readonly answer: string;
};

export const FAQS: readonly Faq[] = [
  {
    question: "how fast is fast?",
    answer:
      "most requests come back in a couple of business days. bigger builds get a clear timeline up front, so you're never left guessing — just refreshing.",
  },
  {
    question: "is there a limit to requests?",
    answer:
      "add as many as you like. we work one at a time and move straight to the next the moment one ships, so the queue is always yours to reorder.",
  },
  {
    question: "what if i don't like it?",
    answer:
      "you get unlimited revisions until it's right. same request, same team — we keep refining until it's something you'd actually put your name on.",
  },
  {
    question: "can i really pause?",
    answer:
      "yes. pause any time and your billing pauses with it. when you're ready, pick up exactly where you left off — no re-onboarding, no lost context.",
  },
  {
    question: "who actually does the work?",
    answer:
      "the same senior team, every request. no matched freelancer, no rotating roster, no handing your brand to whoever's free that week.",
  },
  {
    question: "what don't you do?",
    answer:
      "no pitch decks, no print, no throwaway spec work. we design and build digital products — brand, web, and product — and we do it end to end.",
  },
];

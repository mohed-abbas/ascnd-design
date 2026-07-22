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

/**
 * The /pricing FAQ (Figma frame 746:4593) — the same glass-pill design as the
 * homepage set above, but eight subscription-focused questions aimed at someone
 * on the pricing page deciding whether to start. Questions are verbatim from the
 * mock; the answers are authored here in the same voice, and kept consistent with
 * the plan-comparison copy (plan-compare-data.ts).
 */
export const PRICING_FAQS: readonly Faq[] = [
  {
    question: "how does pausing actually work?",
    answer:
      "pause the moment you're between projects and your billing pauses with it. any days you've already paid for are banked, so you resume right where you left off — no re-onboarding, no lost context.",
  },
  {
    question: "what happens right after i subscribe?",
    answer:
      "your board goes live in about an hour. drop in your first requests, and we start on the top one the same day — no lengthy kickoff before anything moves.",
  },
  {
    question: "how many requests can i add?",
    answer:
      "as many as you like. the queue is unlimited and yours to reorder anytime; we work one at a time and move straight to the next the moment one ships.",
  },
  {
    question: "do you do just the design, without code?",
    answer:
      "yes — design-only is completely fine. but we also build the front-end, so if you want it you can take the same request all the way from idea to shipped.",
  },
  {
    question: 'what’s a "request"?',
    answer:
      "one focused piece of work — a screen, a flow, a landing page, a component. scope it however makes sense; we pick them off your queue in the order you set.",
  },
  {
    question: "what if i don't like the work?",
    answer:
      "you get unlimited revisions until it's right. the request stays open, same team on it, until it's something you'd happily put your name on.",
  },
  {
    question: "is it really the same team every time?",
    answer:
      "yes. it's the same senior founders on every request — no rotating freelancers, no handing your brand to whoever's free that week, no re-explaining yourself.",
  },
  {
    question: "what don't you do?",
    answer:
      "no back-end or infra, no throwaway spec work, no rotating cast. we design and build front-end product — brand, web, and interface — and we do it end to end.",
  },
];

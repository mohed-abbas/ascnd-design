/**
 * Pricing content (Figma node 469:680). The two tiers share one inner layout
 * (see PlanCard in pricing.tsx); only the copy + feature lists differ, so they
 * live here as data — mirroring comparison-data.ts.
 */

export type Plan = {
  /** Instrument-serif card title (469:785 / 469:824). */
  readonly title: string;
  /** Supporting line under the feature-block heading (469:793 / 469:833). */
  readonly description: string;
  /** Ticked feature rows (469:794 / 469:834). */
  readonly features: readonly string[];
};

export const SUBSCRIPTION: Plan = {
  title: "subscription",
  description:
    "your ongoing design and front-end team. one request at a time, worked continuously.",
  features: [
    "unlimited requests and revisions",
    "brand, web, and product design",
    "hand-coded next.js + gsap builds",
    "avg. a few business days per request",
    "pause or cancel anytime",
  ],
};

export const FIXED_SPRINT: Plan = {
  title: "fixed sprint",
  description:
    "a defined scope shipped in a set window. for launches and rebrands.",
  features: [
    "clear scope, clear timeline",
    "design and build included",
    "same senior team",
    "50/50 payment split",
  ],
};

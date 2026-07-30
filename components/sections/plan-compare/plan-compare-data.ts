/**
 * "compare plan details" content — Figma frame 678:2856.
 *
 * The two plan columns (header) and the accordion categories. Each category
 * expands to a set of three-column rows: a feature LABEL, its `subscription`
 * value and its `fixedSprint` value.
 *
 * The Figma frame only details the FIRST category ("how it works"); the remaining
 * five carry copy from the comparison-table content sheet (design / build /
 * working together / ownership / what we don't do). ✓/✕ marks are rendered from
 * codebase icons (see plan-compare.tsx), so cells use "check" / "cross" sentinels.
 */
import type { ComponentType } from "react";
import type { ButtonVariant } from "@/components/ui/button";
import {
  BuildIcon,
  DesignIcon,
  DontIcon,
  HowItWorksIcon,
  OwnershipIcon,
  TogetherIcon,
} from "./plan-compare-icons";

export type PlanColumn = {
  readonly key: string;
  /** Instrument-serif column title (678:2614 / 678:2638). */
  readonly title: string;
  /** Supporting line under the title (678:2617 / 678:2640). */
  readonly note: string;
  /** CTA label + which shared <Button> skin it uses. */
  readonly cta: string;
  readonly ctaVariant: ButtonVariant;
  /** Where the CTA points. This section is /pricing-only, so the booking CTA
   *  glides to that page's own inline calendar (#book, book-a-call.tsx) rather
   *  than opening the Cal.com modal — the homepage is the only place that
   *  modal is used. Omitted → the CTA is still unwired (waiting on Stripe). */
  readonly ctaHref?: string;
};

export const PLAN_COLUMNS: readonly PlanColumn[] = [
  {
    key: "subscription",
    title: "subscription",
    note: "$5,995 / month",
    cta: "start now",
    ctaVariant: "solid",
  },
  {
    key: "fixed-sprint",
    title: "fixed sprint",
    note: "let’s talk",
    cta: "book a call",
    ctaVariant: "clear",
    ctaHref: "#book",
  },
];

/** A comparison cell: an included tick ("check"), an excluded cross ("cross"), or
 *  a free-text value. */
export type CompareValue = "check" | "cross" | (string & {});

export type CompareRow = {
  readonly label: string;
  readonly subscription: CompareValue;
  readonly fixedSprint: CompareValue;
  /** Optional clarifying line under the label — the "what we don't do" rows use
   *  it to say what we do instead. */
  readonly note?: string;
};

export type CompareCategory = {
  readonly key: string;
  readonly name: string;
  readonly Icon: ComponentType<{ className?: string }>;
  readonly rows: readonly CompareRow[];
};

export const CATEGORIES: readonly CompareCategory[] = [
  {
    key: "how-it-works",
    name: "how it works",
    Icon: HowItWorksIcon,
    rows: [
      {
        label: "active requests",
        subscription: "one at a time, continuous",
        fixedSprint: "full scope at once",
      },
      {
        label: "requests in the queue",
        subscription: "unlimited",
        fixedSprint: "defined upfront",
      },
      {
        label: "revisions",
        subscription: "unlimited",
        fixedSprint: "unlimited in the window",
      },
      {
        label: "average turnaround",
        subscription: "a few business days",
        fixedSprint: "milestone schedule",
      },
      {
        label: "getting started",
        subscription: "board live in ~1 hour",
        fixedSprint: "kickoff after scoping",
      },
      {
        label: "pausing",
        subscription: "anytime, days banked",
        fixedSprint: "n/a — fixed window",
      },
    ],
  },
  {
    key: "design",
    name: "design",
    Icon: DesignIcon,
    rows: [
      { label: "brand identity and logos", subscription: "check", fixedSprint: "check" },
      { label: "web and marketing site design", subscription: "check", fixedSprint: "check" },
      { label: "landing pages", subscription: "check", fixedSprint: "check" },
      { label: "product ui and design systems", subscription: "check", fixedSprint: "check" },
      { label: "pitch decks", subscription: "check", fixedSprint: "when scoped in" },
      { label: "social and content creative", subscription: "check", fixedSprint: "when scoped in" },
      { label: "email design", subscription: "check", fixedSprint: "when scoped in" },
    ],
  },
  {
    key: "build",
    name: "build",
    Icon: BuildIcon,
    rows: [
      { label: "hand-coded next.js front-end", subscription: "check", fixedSprint: "check" },
      { label: "gsap motion and interactions", subscription: "check", fixedSprint: "check" },
      { label: "framer or webflow when it fits", subscription: "check", fixedSprint: "check" },
      { label: "responsive across devices", subscription: "check", fixedSprint: "check" },
      { label: "deployment to vercel", subscription: "check", fixedSprint: "check" },
      { label: "basic cms wiring", subscription: "check", fixedSprint: "check" },
    ],
  },
  {
    key: "working-together",
    name: "working together",
    Icon: TogetherIcon,
    rows: [
      { label: "your request board", subscription: "check", fixedSprint: "milestone tracker" },
      { label: "brief in text, doc, or loom", subscription: "check", fixedSprint: "check" },
      { label: "same senior team, every time", subscription: "check", fixedSprint: "check" },
      { label: "meetings", subscription: "async-first, optional", fixedSprint: "kickoff + milestones" },
    ],
  },
  {
    key: "ownership",
    name: "ownership",
    Icon: OwnershipIcon,
    rows: [
      { label: "every design file is yours", subscription: "check", fixedSprint: "check" },
      { label: "every line of code is yours", subscription: "check", fixedSprint: "check" },
      { label: "source figma files included", subscription: "check", fixedSprint: "check" },
      { label: "repo handed over", subscription: "check", fixedSprint: "check" },
    ],
  },
  {
    key: "what-we-dont-do",
    name: "what we don’t do",
    Icon: DontIcon,
    rows: [
      {
        label: "backend development",
        subscription: "cross",
        fixedSprint: "cross",
        note: "we build the front-end and integrate with your api",
      },
      {
        label: "paid ads management",
        subscription: "cross",
        fixedSprint: "cross",
        note: "we make the creative, you run the spend",
      },
      {
        label: "long-form content writing",
        subscription: "cross",
        fixedSprint: "cross",
        note: "we design around your words",
      },
      {
        label: "seo campaigns",
        subscription: "cross",
        fixedSprint: "cross",
        note: "technical seo hygiene is built in, campaigns aren’t",
      },
      {
        label: "hourly billing",
        subscription: "cross",
        fixedSprint: "cross",
        note: "never. that’s the point.",
      },
    ],
  },
];

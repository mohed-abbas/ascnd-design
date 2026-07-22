/**
 * "compare plan details" content — Figma frame 678:2856.
 *
 * The two plan columns (header) and the accordion categories. Each category
 * expands to a set of three-column rows: a feature LABEL, its `subscription`
 * value and its `fixedSprint` value.
 *
 * ⚠️ The Figma frame only details the FIRST category ("how it works") — the other
 * five are shown collapsed with no row content in the design, so their `rows` are
 * empty here pending copy. Fill them in the same shape once provided.
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
  },
];

export type CompareRow = {
  readonly label: string;
  readonly subscription: string;
  readonly fixedSprint: string;
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
        fixedSprint: "n/a - fixed window",
      },
    ],
  },
  // The design leaves these five collapsed with no rows — awaiting copy.
  { key: "design", name: "design", Icon: DesignIcon, rows: [] },
  { key: "build", name: "build", Icon: BuildIcon, rows: [] },
  {
    key: "working-together",
    name: "working together",
    Icon: TogetherIcon,
    rows: [],
  },
  { key: "ownership", name: "ownership", Icon: OwnershipIcon, rows: [] },
  { key: "what-we-dont-do", name: "what we don’t do", Icon: DontIcon, rows: [] },
];

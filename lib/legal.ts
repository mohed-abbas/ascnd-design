/**
 * The variable parts of the three legal pages — /terms, /privacy, /refunds.
 *
 * ⚠️ EVERY `[bracketed]` VALUE BELOW IS A PLACEHOLDER AND MUST BE REPLACED
 * BEFORE THESE PAGES GO LIVE. They render verbatim into published legal text,
 * so shipping them as-is publishes bracketed stubs to real visitors.
 *
 * LEGAL_DETAILS is now fully set. The only brackets left in this file are in
 * LEGAL_PROCESSORS at the bottom — six of its seven rows are still stubs, and
 * they render as a visible list in the privacy policy's §3.
 *
 * The prose in components/sections/legal/ is transcribed from the source
 * documents in files/*.md, which carried these same values as `[BRACKETS]`
 * inline. Hoisting them here means the copy reads cleanly, the same email or
 * day-count can't drift between two pages that both quote it (the pause window
 * and the refund rules are each stated in two documents), and going live is one
 * file to edit rather than three components to comb through.
 *
 * The bracket style is deliberate: an unreplaced value reads as "[legal entity
 * name]" on the page, which is unmissable. A plausible-looking dummy would not
 * be.
 *
 * Server-safe: pure data, no browser APIs.
 */

export const LEGAL_DETAILS = {
  /** Shown under every page title. A written date, not a generated one — it
   *  means "when the terms last changed", not "when this built", so it must be
   *  updated by hand whenever the wording of any of the three documents
   *  changes. Lowercased to match the site's voice.
   *  SET — this is the one value below that is no longer a placeholder. */
  lastUpdated: "31 july 2026",

  /** The country ascnd operates from. Named in both preambles and,
   *  load-bearingly, in the privacy policy's international-transfers section
   *  (no UK/EU adequacy decision). SET.
   *
   *  There is deliberately no `entityName` or `registeredAddress` beside it.
   *  ascnd is not a registered company: it is a sole proprietorship, so there
   *  is no separate legal entity to name and no registered address to print.
   *  Both preambles therefore read "operated as a sole proprietorship based in
   *  {country}" as fixed prose, and the contact blocks are email + domain.
   *  ⚠️ ON INCORPORATION: add `entityName` and `registeredAddress` back here,
   *  and restore the operator/address clauses in terms.tsx and privacy.tsx —
   *  the sentence is prose in those two files now, not a substitution, so
   *  editing this file alone will not update the pages. */
  country: "Pakistan",

  /** General contact — cancellations, pauses, refund requests. SET. */
  contactEmail: "contact@ascnd.design",
  /** Data-protection contact — subject-access requests and privacy questions.
   *  Currently the same address as `contactEmail`; it stays a separate field
   *  because the privacy policy promises a 30-day response against it
   *  specifically, so it can be split off without touching the copy. SET. */
  privacyEmail: "contact@ascnd.design",

  /** Payment terms (ToS §4). `invoiceDueDays` is the window from issue to due;
   *  `latePaymentGraceDays` is how long past the due date before work pauses. */
  invoiceDueDays: "7",
  latePaymentGraceDays: "7",

  /** How long a subscription may stay paused before it converts to a
   *  cancellation (ToS §5, restated on the refunds page). */
  maxPauseDuration: "3 months",

  /** Working days from refund approval to the money landing back (refunds
   *  page). */
  refundBusinessDays: "10",

  /** Governing law and the courts with exclusive jurisdiction (ToS §14). SET. */
  governingLaw: "Pakistan",
  jurisdictionCity: "Islamabad",
} as const;

/**
 * The third parties that process personal data on our behalf — rendered as the
 * list in the privacy policy's "who we share it with" section.
 *
 * ⚠️ TRIM THIS TO THE TOOLS ACTUALLY IN USE. The source document flagged this
 * explicitly, and it is not cosmetic: naming a processor you don't use is as
 * much of a compliance problem as omitting one you do. Delete the rows that
 * don't apply and replace each `[bracketed]` name with the real vendor.
 *
 * `name` is the vendor; `purpose` is what they do with the data. Cal.com is the
 * one entry already confirmed — the booking embed is live on /pricing
 * (components/sections/book-a-call).
 */
export type LegalProcessor = { name: string; purpose: string };

export const LEGAL_PROCESSORS: readonly LegalProcessor[] = [
  { name: "[hosting provider, e.g. Vercel]", purpose: "website hosting" },
  { name: "Cal.com", purpose: "call bookings" },
  { name: "[email provider, e.g. Google Workspace]", purpose: "email" },
  {
    name: "[analytics provider, e.g. Google Analytics / Plausible]",
    purpose: "site analytics",
  },
  {
    name: "[file storage, e.g. Google Drive, Figma]",
    purpose: "storing and sharing project files",
  },
  {
    name: "[payment / invoicing, e.g. Wise, Payoneer]",
    purpose: "invoicing and receiving payment",
  },
  {
    name: "[project comms, e.g. Slack, Notion]",
    purpose: "client communication and request tracking",
  },
];

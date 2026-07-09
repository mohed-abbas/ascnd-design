/**
 * Testimonials copy (Figma node 482:469). A quote is a list of segments so the
 * mixed-font emphasis (`already raised` set in Instrument Serif mid-sentence)
 * survives as structured data rather than dangerouslySetInnerHTML — and so the
 * section can later cycle through several quotes with the same renderer.
 *
 * Curly quotes are baked into the first/last segment text to match the design.
 */
export type QuoteSegment = {
  text: string;
  /** Render this run in the Instrument Serif accent face. */
  serif?: boolean;
};

export type Testimonial = {
  id: string;
  quote: QuoteSegment[];
};

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "already-raised",
    quote: [
      { text: "“they made us look like a company that " },
      { text: "already raised", serif: true },
      { text: ", three weeks before we pitched.”" },
    ],
  },
];

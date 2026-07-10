/**
 * Hover → next-quote signal. Fired by a Rock (inside the R3F canvas render
 * tree) when the pointer enters it; the quote-reveal driver (DOM tree)
 * subscribes and swaps to the next testimonial immediately. Module-singleton
 * pub/sub, same shape as testimonials-reveal.ts — the two trees share no React
 * context, so this is the bridge.
 */

type Cb = () => void;

const subs = new Set<Cb>();

/** Ask the quote cycler to advance now (no-op if it isn't ready / mid-swap). */
export function requestQuoteAdvance() {
  for (const cb of subs) cb();
}

export function onQuoteAdvance(cb: Cb) {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

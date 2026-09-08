/**
 * The contract shared by the footer wordmark's two halves — footer.tsx, which
 * renders the letters and builds one SVG filter per letter, and
 * wordmark-texture.tsx, which drives those filters from the pointer.
 *
 * It exists because the two must agree on the letters and on the filter ids,
 * and holding that agreement in a comment is exactly how lib/nav-links.ts's
 * duplicated literals drifted: a stale copy here doesn't error, it silently
 * stops matching and the effect just never fires. One module, imported by both,
 * makes that impossible.
 *
 * Server-safe: pure data, no browser APIs, so the server component can import
 * it as freely as the client one.
 */

/** The wordmark, split so each letter can be distorted on its own. */
export const WORDMARK_LETTERS = ["a", "s", "c", "n", "d"] as const;

/** Filter id prefix; each letter's filter is `${WORDMARK_FX_ID}-${index}`. */
export const WORDMARK_FX_ID = "footer-wordmark-fx";

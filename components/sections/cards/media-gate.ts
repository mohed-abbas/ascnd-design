/**
 * Card media gate (Option D — "narrative deal").
 *
 * The card entrance drives WHEN each card's inner media first runs: as a shell's
 * blur-rise lands, CardsReveal calls `releaseMedia(id)`, and that card's media
 * (which has been holding, paused) begins — so the eye is led subscribe →
 * request → receive instead of all three looping independently from the start.
 *
 * It's a tiny pub/sub keyed by card id (the shell's `data-card-id`). The
 * released set is remembered so a release that fires BEFORE a media subscribes
 * — e.g. the page loads already scrolled to the section, and ScrollTrigger fires
 * during CardsReveal's layout effect, before the media's useEffect runs — is not
 * missed: a late subscriber that finds its id already released fires at once.
 */
export type CardMediaId = "subscribe" | "request" | "receive";

const released = new Set<string>();
const listeners = new Map<string, Set<() => void>>();

/** Called by CardsReveal when a card's entrance lands — starts its media. */
export function releaseMedia(id: string) {
  if (!id) return;
  released.add(id);
  listeners.get(id)?.forEach((cb) => cb());
}

/**
 * Subscribe a media component to its release. Fires `cb` immediately if the card
 * was already released (race-proof), else when `releaseMedia(id)` is next called.
 * Returns an unsubscribe for cleanup.
 */
export function onMediaRelease(id: CardMediaId, cb: () => void): () => void {
  if (released.has(id)) {
    cb();
    return () => {};
  }
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(cb);
  return () => set?.delete(cb);
}

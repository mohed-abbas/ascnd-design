/**
 * The testimonials reveal gate — one shared signal the rocks (R3F canvas) and
 * the rings (DOM) both read, so a reveal that spans two render systems stays in
 * lockstep. Same "shared animation gate" idea as intro-state.ts — and, like it,
 * ONE-SHOT per page load:
 *
 *  - PLAY  — the section is ~half in the viewport (from either direction). Both
 *            sides create their GSAP tweens in the same synchronous broadcast,
 *            so identical timing constants (REVEAL, testimonials-data.ts) ===
 *            frame-sync. Fires ONCE; later passes are no-ops.
 *  - RESET — the section has fully left the viewport. Only meaningful before the
 *            entrance has played; after that it's a no-op, so the rocks/rings
 *            stay at rest instead of re-parking for a second entrance.
 *
 * Module singleton on purpose: the canvas and the DOM drivers live in different
 * subtrees, and this keeps them on one clock without prop-drilling. `played`
 * lets late mounts (context-loss canvas remount mid-view) skip the entrance and
 * appear directly at rest.
 *
 * ⚠️ ONCE PER PAGE LOAD. The entrance used to replay on every pass (leave the
 * section → RESET → come back → PLAY again), which read as the animation
 * re-triggering on scroll-up. The gate is now LATCHED: the first PLAY broadcasts,
 * every later PLAY is a no-op, and RESET no longer broadcasts (it only rewinds
 * the latch before the entrance has ever run). So once the rocks/rings have flown
 * in they stay at rest for the rest of the page's life, and re-entering the
 * section shows them already home — late mounts get that for free via the
 * `isTestimonialsRevealPlayed()` checks the consumers already do.
 *
 * The RESET subscription API is kept (the three consumers still subscribe) so the
 * behaviour is one edit to revert, not a five-file unwind.
 */

type Cb = () => void;

let played = false;
const playSubs = new Set<Cb>();
const resetSubs = new Set<Cb>();

export function playTestimonialsReveal() {
  if (played) return;
  played = true;
  for (const cb of playSubs) cb();
}

export function resetTestimonialsReveal() {
  // Latched: once the entrance has played it never un-plays, so nothing to
  // rewind and no reset broadcast. Before that, this is unreachable in practice
  // (the section can't leave the viewport un-played without also never having
  // crossed the reveal line) but stays correct if it ever is.
  if (played) return;
  for (const cb of resetSubs) cb();
}

export function isTestimonialsRevealPlayed() {
  return played;
}

/** Subscribe to PLAY (every pass). Returns an unsubscribe. */
export function onTestimonialsRevealPlay(cb: Cb) {
  playSubs.add(cb);
  return () => {
    playSubs.delete(cb);
  };
}

/** Subscribe to RESET (section fully left). Returns an unsubscribe. */
export function onTestimonialsRevealReset(cb: Cb) {
  resetSubs.add(cb);
  return () => {
    resetSubs.delete(cb);
  };
}

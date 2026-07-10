/**
 * The testimonials reveal gate — one shared signal the rocks (R3F canvas) and
 * the rings (DOM) both read, so a reveal that spans two render systems stays in
 * lockstep. Same "shared animation gate" idea as intro-state.ts, but REPLAYABLE:
 *
 *  - PLAY  — the section is ~half in the viewport (from either direction). Both
 *            sides create their GSAP tweens in the same synchronous broadcast,
 *            so identical timing constants (REVEAL, testimonials-data.ts) ===
 *            frame-sync. Fires on EVERY pass through the section.
 *  - RESET — the section has fully left the viewport. Both sides snap back to
 *            their parked pre-reveal state (rocks off-screen + invisible, rings
 *            hidden) so the next pass plays the entrance again.
 *
 * Module singleton on purpose: the canvas and the DOM drivers live in different
 * subtrees, and this keeps them on one clock without prop-drilling. `played`
 * lets late mounts (context-loss canvas remount mid-view) skip the entrance and
 * appear directly at rest.
 */

type Cb = () => void;

let played = false;
const playSubs = new Set<Cb>();
const resetSubs = new Set<Cb>();

export function playTestimonialsReveal() {
  played = true;
  for (const cb of playSubs) cb();
}

export function resetTestimonialsReveal() {
  played = false;
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

/**
 * The testimonials reveal gate — one shared signal the rocks (R3F canvas) and
 * the rings (DOM) both read, so a reveal that spans two render systems stays in
 * lockstep. It's the same "shared animation gate" idea as intro-state.ts.
 *
 * Two phases:
 *  - ARM   — fired once the section decides it WILL do the 3D reveal (a capable
 *            device, tier on). Consumers use it to snap to the hidden pre-reveal
 *            state (rings invisible) BEFORE the section is ever on screen, so
 *            nothing flashes. Not armed → the section renders its resting pose
 *            (flat rocks, static rings) and this gate stays dormant.
 *  - START — fired once the section actually enters view. Both sides create
 *            their GSAP tweens in the same synchronous broadcast, so identical
 *            timing constants (REVEAL, testimonials-data.ts) === frame-sync.
 *
 * Module singleton on purpose: the reveal plays once per page load. Subscribers
 * that mount after a phase already fired get called immediately (the anchor-jump
 * case, where warm-mount and enter-view collapse together).
 */

type Cb = () => void;

let armed = false;
let started = false;
const armSubs = new Set<Cb>();
const startSubs = new Set<Cb>();

export function armTestimonialsReveal() {
  if (armed) return;
  armed = true;
  for (const cb of armSubs) cb();
}

export function startTestimonialsReveal() {
  if (started) return;
  started = true;
  for (const cb of startSubs) cb();
}

export function isTestimonialsRevealArmed() {
  return armed;
}

export function isTestimonialsRevealStarted() {
  return started;
}

/** Subscribe to ARM; fires immediately if already armed. Returns an unsubscribe. */
export function onTestimonialsRevealArm(cb: Cb) {
  armSubs.add(cb);
  if (armed) cb();
  return () => {
    armSubs.delete(cb);
  };
}

/** Subscribe to START; fires immediately if already started. Returns an unsubscribe. */
export function onTestimonialsRevealStart(cb: Cb) {
  startSubs.add(cb);
  if (started) cb();
  return () => {
    startSubs.delete(cb);
  };
}

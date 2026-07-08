/**
 * The showcase wheel's scroll progress (0 → 1), shared between the DOM pin
 * driver and the WebGL rig.
 *
 * The pin ScrollTrigger lives in the DOM (showcase-scroll.tsx) — it owns the
 * layout concern (pin the section, add scroll distance). The rotation lives in
 * WebGL (showcase-canvas.tsx, WheelScrollRig) — it owns the render. This tiny
 * framework-agnostic store bridges them: the driver writes progress on scroll,
 * the rig reads it, turns the wheel, and repaints the demand canvas. One
 * ScrollTrigger, one source of truth — no competing schedulers (the driver's
 * onUpdate is pumped by the shared Lenis/GSAP tick, like the cloud rigs).
 */

let progress = 0;
const listeners = new Set<(p: number) => void>();

export function setWheelProgress(p: number): void {
  progress = p;
  for (const l of listeners) l(p);
}

export function getWheelProgress(): number {
  return progress;
}

export function subscribeWheelProgress(listener: (p: number) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

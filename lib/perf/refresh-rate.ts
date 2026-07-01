/**
 * Display refresh-rate detection (docs/performance-audit.md §6 C1).
 *
 * `matchMedia("(update: fast)")` only reports fast/slow, never the actual Hz, so
 * the standard technique is to sample a burst of requestAnimationFrame deltas and
 * take the median (robust against a few janky boot frames). Run once at startup.
 *
 * SSR-safe: returns 60 when rAF/performance are unavailable.
 */

/** The refresh rates worth distinguishing; measured Hz snaps to the nearest. */
const KNOWN_RATES = [60, 75, 90, 120, 144, 165, 240] as const;

export function snapRate(hz: number): number {
  return KNOWN_RATES.reduce((best, r) =>
    Math.abs(r - hz) < Math.abs(best - hz) ? r : best
  );
}

/**
 * Sample `samples` rAF deltas and resolve the snapped refresh rate in Hz.
 * Deltas outside a sane window (0, 100 ms) are dropped so a hidden tab, an
 * alt-tab, or the first cold frame can't skew the median.
 */
export function detectRefreshRate(samples = 30): Promise<number> {
  if (
    typeof performance === "undefined" ||
    typeof requestAnimationFrame === "undefined"
  ) {
    return Promise.resolve(60);
  }

  return new Promise((resolve) => {
    const deltas: number[] = [];
    let prev = performance.now();
    let count = 0;

    const tick = (now: number) => {
      const d = now - prev;
      prev = now;
      if (d > 0 && d < 100) deltas.push(d);
      if (++count < samples) {
        requestAnimationFrame(tick);
        return;
      }
      if (deltas.length === 0) {
        resolve(60);
        return;
      }
      deltas.sort((a, b) => a - b);
      const median = deltas[Math.floor(deltas.length / 2)];
      resolve(snapRate(1000 / median));
    };

    requestAnimationFrame(tick);
  });
}

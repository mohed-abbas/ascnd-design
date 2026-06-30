/**
 * Shared gate for the welcome intro. Both <Intro> (which plays the WebGL
 * animation) and <HeroReveal> (which must WAIT for the intro to dock before
 * cascading the hero in) read `introWillPlay()` — memoised so it resolves the
 * SAME way for both within a page load. <Intro> dispatches INTRO_REVEAL_EVENT
 * at the dock; HeroReveal / RockReveal / DesignShotsReveal listen for it.
 *
 * The intro replays on EVERY load that lands at the hero (top of page). It's
 * suppressed by an explicit ?intro=skip, reduced-motion, missing WebGL, OR a
 * load the browser restores mid-page (e.g. refreshing while scrolled down to a
 * lower section): the glass docks onto the hero's wordmark and its rocks sit at
 * the hero's base, so off the hero it has nothing to land on and would only
 * lock scroll over content it doesn't belong to.
 */

export const INTRO_REVEAL_EVENT = "ascnd:intro-reveal";

/**
 * Fired when the intro timeline STARTS (the glass rises and the WebGL rocks
 * drift in) — as opposed to INTRO_REVEAL_EVENT, which fires later at the dock.
 * Background elements that belong to the scene from the first frame (the
 * volumetric clouds) settle in on this, alongside the rock entrance, so they're
 * present throughout the welcome rather than popping in at the end.
 */
export const INTRO_START_EVENT = "ascnd:intro-start";

/**
 * Fired by <IntroLoader> when its welcome animation has fully played and faded
 * out — the cue for <Intro> to start its master timeline. This INVERTS the old
 * order: the loader now LEADS (plays its ~4.5s show while the WebGL scene warms
 * up silently underneath), then releases the intro, instead of the intro
 * starting on scene-paint and the loader dismissing behind it. <Intro> gates its
 * timeline on this (with a failsafe), so the glass never rises under the cover.
 */
export const INTRO_GO_EVENT = "ascnd:intro-go";

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Cheap WebGL-capability probe (same idea as cloud-layer.tsx). The intro's rocks
 * are drawn in WebGL while the hero's DOM rocks stay parked; if WebGL can't run
 * we must NOT play, or the welcome would show no rocks until the failsafe fires.
 * Skipping lets hero-reveal / rock-reveal / design-shots-reveal fall through to
 * their immediate path, so the DOM rocks appear normally.
 */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

// How close to the top counts as "at the hero". The browser restores scroll to
// the exact saved pixel, so a small epsilon just absorbs sub-pixel rounding.
const TOP_EPSILON = 4;

/**
 * Are we (essentially) at the top of the page? On a hard refresh the browser
 * restores the previous scroll position during the initial layout — before
 * React hydration runs — so `scrollY` already reflects the restored position by
 * the time this first evaluates (Lenis hasn't initialised yet, so this is the
 * native value, not a reset-to-0). `introWillPlay()` is memoised, so the answer
 * is captured once and stays consistent for <Intro> and the reveals.
 */
function atHeroTop(): boolean {
  const y =
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body?.scrollTop ||
    0;
  return y <= TOP_EPSILON;
}

function computeShouldPlay(): boolean {
  if (typeof window === "undefined") return false;

  // Dev/QA overrides: ?intro=force always plays (even mid-page), ?intro=skip never.
  const q = new URLSearchParams(window.location.search).get("intro");
  if (q === "force") return true;
  if (q === "skip") return false;

  if (window.matchMedia(REDUCE_MOTION).matches) return false;
  // No WebGL → the glass/rocks can't render; skip so the DOM rocks reveal normally.
  if (!hasWebGL()) return false;
  // Only welcome at the hero — never strand a mid-page refresh under a locked,
  // off-screen intro (see file header).
  if (!atHeroTop()) return false;
  return true;
}

let cached: boolean | undefined;

/** Resolved once per page load (memoised so <Intro> and the reveals agree). */
export function introWillPlay(): boolean {
  if (cached === undefined) cached = computeShouldPlay();
  return cached;
}

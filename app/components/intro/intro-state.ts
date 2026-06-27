/**
 * Shared gate for the welcome intro. Both <Intro> (which plays the WebGL
 * animation) and <HeroReveal> (which must WAIT for the intro to dock before
 * cascading the hero in) read `introWillPlay()` — memoised so it resolves the
 * SAME way for both, and crucially is captured BEFORE <Intro> marks the session
 * seen. <Intro> dispatches INTRO_REVEAL_EVENT at the dock; HeroReveal listens.
 */

export const INTRO_SEEN_KEY = "ascnd:intro-seen";
export const INTRO_REVEAL_EVENT = "ascnd:intro-reveal";

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

function computeShouldPlay(): boolean {
  if (typeof window === "undefined") return false;

  // Dev/QA overrides: ?intro=force always plays, ?intro=skip never does.
  const q = new URLSearchParams(window.location.search).get("intro");
  if (q === "force") return true;
  if (q === "skip") return false;

  if (window.matchMedia(REDUCE_MOTION).matches) return false;
  try {
    if (sessionStorage.getItem(INTRO_SEEN_KEY)) return false;
  } catch {
    /* private mode / blocked storage — fall through and play */
  }
  return true;
}

let cached: boolean | undefined;

/** Resolved once per page load, before the session is marked seen. */
export function introWillPlay(): boolean {
  if (cached === undefined) cached = computeShouldPlay();
  return cached;
}

export function markIntroSeen(): void {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

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
 * Fired by <Intro> the moment its WebGL scene has GENUINELY painted
 * (SceneReady: chunk downloaded, textures resolved, shaders compiled, frames
 * drawn). <IntroLoader> listens so its cover can hold — bar creeping toward
 * full — until the welcome can actually be seen, instead of fading out on a
 * fixed clock over a scene that is still downloading (the bare-sky gap).
 */
export const INTRO_SCENE_READY_EVENT = "ascnd:intro-scene-ready";

/**
 * Fired by <Intro> when the lazy intro-scene chunk (three.js/drei/R3F) has
 * finished downloading + parsing — the biggest single milestone of the warm-up
 * on a slow connection. <IntroLoader> uses it to advance its progress bar with
 * REAL signal between "JS arrived" and "scene painted".
 */
export const INTRO_CHUNK_READY_EVENT = "ascnd:intro-chunk-ready";

/**
 * The welcome is NEVER skipped for being slow — visitors on 3G wait under the
 * loader (bar creeping on real milestones) and then get the full intro. This
 * is the LAST-RESORT safety net only: if the scene hasn't painted by now the
 * load is considered wedged (driver hang, chunk 404, offline mid-load) and
 * <Intro> bails to the DOM hero so the page can never be stranded under the
 * cover forever. Dev builds get a far larger budget purely because unminified
 * dev chunks are ~10× production size — hitting this in dev on a throttled
 * profile is expected physics, not a wedge.
 * All downstream timer backstops (loader hard-cap, hero-reveal, design-shots)
 * must sit ABOVE this so they can never race a live welcome.
 */
export const INTRO_LAST_RESORT_MS =
  process.env.NODE_ENV === "development" ? 120_000 : 45_000;

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

/**
 * Has the intro already fired its reveal this page load? Tracked module-side (a
 * single passive once-listener) so a component that MOUNTS after the dock — e.g.
 * the custom cursor when a mouse is plugged in mid-session, since its gate mounts
 * live on pointer/breakpoint changes — can tell the welcome is already over and
 * skip its intro gate instead of waiting for an event that will never refire.
 */
let revealed = false;
if (typeof window !== "undefined") {
  window.addEventListener(
    INTRO_REVEAL_EVENT,
    () => {
      revealed = true;
    },
    { once: true },
  );
}

export function introHasRevealed(): boolean {
  return revealed;
}

/**
 * Did the intro's master timeline actually START (INTRO_START fired)? Distinct
 * from introWillPlay() — the INTENT decided at load. The intro can intend to
 * play and then never start: the SKIP_BUDGET bail on slow networks, or the
 * can't-place-the-glass bail. Consumers that hand a job to the WELCOME must
 * check this at reveal time, not the intent: hero-reveal skips the navbar
 * wordmark only when the glass really docks onto it (the timeline owns that
 * crossfade) — on a skipped intro the wordmark must join the DOM cascade, or
 * nothing would ever reveal it.
 */
let started = false;
if (typeof window !== "undefined") {
  window.addEventListener(
    INTRO_START_EVENT,
    () => {
      started = true;
    },
    { once: true },
  );
}

export function introHasStarted(): boolean {
  return started;
}

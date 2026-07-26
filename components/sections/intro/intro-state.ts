/**
 * Shared gate for the welcome intro. Both <Intro> (which plays the WebGL
 * animation) and <HeroReveal> (which must WAIT for the intro to dock before
 * cascading the hero in) read `introWillPlay()` — memoised so it resolves the
 * SAME way for both within a page load. <Intro> dispatches INTRO_REVEAL_EVENT
 * at the dock; HeroReveal / RockReveal / DesignShotsReveal listen for it.
 *
 * The intro replays on every DOCUMENT load of the homepage — a first visit or
 * a refresh, never a client-side navigation (see introPending(): route mounts
 * re-occur on every SPA nav, but the welcome is consumed once per document
 * load). Every homepage document load OPENS AT THE HERO by policy: the
 * layout's inline script strips any #fragment, disables scroll restoration
 * and zeroes the viewport (parse + load), and intro.tsx re-zeroes right
 * before it measures — so there is no "restored mid-page" load to suppress
 * for anymore. Suppression is only ?intro=skip, reduced-motion, or missing
 * WebGL.
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
    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    // Free the probe context immediately so it doesn't count against the
    // browser's WebGL context budget (same pattern as cloud-layer.tsx). On
    // Firefox this logs a benign "WebGL context was lost." line — that's the
    // intentional teardown, not an error.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

// The pathname this DOCUMENT loaded on, captured at module-evaluation time
// (the root layout's client components import this module, so it evaluates
// during the initial load of every route — always before any client-side
// navigation). The welcome belongs to HARD loads of the homepage only:
// computeShouldPlay pins its route check to this instead of the live pathname,
// so a client-side arrival at "/" (e.g. from /pricing) can never read as a
// homepage load, no matter when the memoised decision is first evaluated.
const INITIAL_PATH =
  typeof window !== "undefined" ? window.location.pathname : "";

function computeShouldPlay(): boolean {
  if (typeof window === "undefined") return false;

  // The welcome is a HOMEPAGE-only feature: <Intro> and <IntroLoader> are
  // composed in app/page.tsx and mount nowhere else. On any other route
  // (e.g. /pricing) no intro exists, so INTRO_START/REVEAL never fire — anything
  // that waits on the welcome (the cloud RevealRig, the static useIntroReveal)
  // must take its IMMEDIATE path there, or it hangs until the last-resort
  // failsafe (the "clouds appear seconds late on /pricing" bug).
  // INITIAL_PATH, not the live pathname: the decision belongs to the document
  // load, so an SPA navigation to "/" from an interior page stays a no-play.
  if (INITIAL_PATH !== "/") return false;

  if (window.matchMedia(REDUCE_MOTION).matches) return false;
  // No WebGL → the glass/rocks can't render; skip so the DOM rocks reveal normally.
  if (!hasWebGL()) return false;
  // NO scroll-position gate here (the old atHeroTop() check): homepage loads
  // are FORCED to the top by the layout's inline script, and reading scrollY
  // at hydration raced browsers that restore/anchor scroll late — a transient
  // non-zero value suppressed the welcome into the glitchy loader quick-fade
  // and stranded the visitor mid-page. The welcome now always plays at the
  // hero; intro.tsx zeroes any stray scroll right before it measures.
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
 * Is a welcome still OWED this document load? True from a homepage hard load
 * until the reveal fires (dock, bail, or <Intro>'s unmount-consume). This —
 * not introWillPlay() — is what the mount gates (<Intro>, <IntroLoader>) and
 * every reveal-waiting consumer must read: introWillPlay() is the memoised
 * INTENT and stays true for the whole document lifetime, so on a client-side
 * navigation back to the homepage it alone would replay the welcome (or park
 * the hero behind a reveal that already happened). Reading THIS instead makes
 * the welcome single-shot per document load: it triggers on first load and
 * refresh only, never on an SPA return.
 */
export function introPending(): boolean {
  return introWillPlay() && !revealed;
}

/** Did this document's initial load happen on the homepage? <IntroLoader> uses
 *  it to tell a homepage HARD load with a suppressed welcome (its SSR cover has
 *  painted — fade it out gently) from a client-side arrival (no SSR cover
 *  exists and none must ever paint). */
export function documentLoadedOnHome(): boolean {
  return INITIAL_PATH === "/";
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

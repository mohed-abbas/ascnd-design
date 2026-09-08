/**
 * Per-history-entry scroll restoration for BACK / FORWARD.
 *
 * WHY THIS FILE EXISTS. Two deliberate behaviours combined to make every
 * back/forward land at the top of the page instead of where the reader left it:
 *
 *  1. layout.tsx sets `history.scrollRestoration = "manual"` before first paint.
 *     That is load-bearing for the homepage — the welcome intro must open at the
 *     hero, and the browser's default "auto" restores a mid-page offset on
 *     refresh. But scrollRestoration is a property of the HISTORY ENTRY, not of
 *     the load, so it stays "manual" for every entry the session pushes
 *     afterwards. The App Router does no scroll restoration of its own (unlike
 *     the Pages Router's `experimental.scrollRestoration`, which is off and
 *     doesn't apply here) — it leans on the browser's, which we had switched off.
 *  2. LenisProvider's route-change effect force-scrolls to 0 on EVERY pathname
 *     change, which is right for a forward navigation and wrong for a pop.
 *
 * So restoration has to be ours. This module keeps the offset of each history
 * entry this document has visited and puts it back on a pop. Reload still opens
 * at the top (that's (1), untouched); a link still lands at the top; only
 * back/forward restore — which is exactly the split the browser would give us if
 * we could leave scrollRestoration alone.
 *
 * ENTRY IDENTITY. The App Router keeps no stable per-entry key in `history.state`
 * (it stores `__NA` + its own routing tree), so we stamp our own and MERGE it in —
 * never replace the object, or the router's own back/forward handling breaks.
 *
 * WHO DRIVES THE RESTORE depends on whether the pop crosses routes:
 *  - Same pathname (a hash entry): nothing re-renders, so this module restores
 *    immediately in the popstate handler.
 *  - Different pathname: the new page has to commit first, so the offset is
 *    parked here and LenisProvider's route effect consumes it — that effect runs
 *    after the newly mounted page's own, which is the earliest moment the
 *    document is tall enough to hold the offset.
 */

/** history.state key holding our entry id. Namespaced — it shares the object
 *  with the App Router's internals. */
const STATE_KEY = "__ascndScrollKey";

/** Backstop only. A parked pop offset is matched to its destination PATHNAME,
 *  which is what actually decides whether it belongs to the route now
 *  committing; this just stops an offset that never found its route (two rapid
 *  pops, a navigation abandoned mid-flight) from sitting there indefinitely and
 *  attaching itself to some later, unrelated visit to the same path. Generous on
 *  purpose — an RSC payload on a cold dev route can take seconds, and an earlier
 *  1s window here silently turned slow back-navigations into scroll-to-top. */
const PENDING_TTL_MS = 30_000;

/** How long the restore keeps re-applying while it waits for the document to
 *  reach its full height (images, fonts, a late-measuring section, a route
 *  Next is still building). Measured at 700ms first: every warm back-navigation
 *  landed, and the FIRST one of a session — the one where the destination route
 *  is cold and the page grows to its real height late — gave up short and left
 *  the reader at the top. It only costs anything while the restore hasn't landed
 *  yet, and any input from the reader ends it immediately. */
const SETTLE_MS = 3000;

/** scrollY per history entry, for this document only. */
const positions = new Map<string, number>();

/**
 * scrollY per PATHNAME — the fallback for an entry whose id we can't read back.
 *
 * The App Router writes its own routing tree into `history.state` during
 * hydration, and that write REPLACES the object rather than merging into it — so
 * the id stamped on the very first entry is gone by the time anyone pops back to
 * it. (Symptom, measured: every back-navigation restored correctly except the
 * first of a session, which landed at the top. Entries stamped later, after a
 * route change, are never touched again and keep their id.) The id is re-stamped
 * whenever it's noticed missing, but the offset recorded under the lost one is
 * only reachable through this map. One entry per path, so it can't tell two
 * visits to the same route apart — that's what the ids are for; this is the net.
 */
const byPath = new Map<string, number>();

let installed = false;
let currentKey: string | null = null;

/** The pathname as of the last route change we saw — the discriminator for
 *  "did this pop cross routes?". */
let lastPath = "";

/**
 * True from the click that starts a navigation until the new route commits.
 * While it's set the tracker stops attributing scrolls to the entry being left —
 * otherwise the router's own scroll-to-top overwrites the offset we just froze.
 */
let navigating = false;

/** A cross-route pop's offset, waiting for the route effect to consume it.
 *  `path` is the entry we popped TO — the route effect only takes the offset if
 *  the route it is committing is that one. */
let pending: { y: number; path: string; at: number } | null = null;

/** Set by LenisProvider so the restore goes through Lenis (which must be told,
 *  or its in-flight glide keeps advancing toward the old target). Falls back to
 *  the native scroller on touch, where no instance exists. */
let scroller: ((y: number) => void) | null = null;

export function setScroller(fn: ((y: number) => void) | null) {
  scroller = fn;
}

function applyScroll(y: number) {
  if (scroller) scroller(y);
  else window.scrollTo(0, y);
}

function readKey(): string | null {
  const s = history.state as Record<string, unknown> | null;
  const k = s && typeof s === "object" ? s[STATE_KEY] : null;
  return typeof k === "string" ? k : null;
}

/**
 * Stamp a fresh id on the CURRENT entry, preserving whatever the router put
 * there. Returns the id.
 *
 * The id must be UNIQUE ACROSS DOCUMENTS, not just within this one — which is
 * why it's random rather than a counter. `history.state` survives a reload, so a
 * freshly loaded document adopts the id the previous one wrote on that entry;
 * with a per-document counter starting over, the next entry it minted collided
 * with that adopted id and the two entries shared one recorded offset. Measured
 * as: every back-navigation restored except the first of a session.
 */
function stampKey(): string {
  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  history.replaceState({ ...(history.state ?? {}), [STATE_KEY]: key }, "");
  return key;
}

/**
 * Put the reader back at `y`, and KEEP putting them there until it sticks.
 *
 * One scrollTo is not enough, for two independent reasons:
 *  - A restored route can commit shorter than it will finally be (an image that
 *    hasn't laid out, a font still swapping), and a scroll into a too-short
 *    document silently clamps.
 *  - ScrollTrigger's pin machinery re-measures around a route change, and a
 *    refresh restores whatever offset it recorded when it STARTED — which,
 *    landing mid-restore, is the pre-restore one. Measured: coming back to a
 *    homepage offset inside the pinned why-stay reel landed at 0 while an offset
 *    below the pin restored fine.
 * So this re-applies each frame until the reader is actually within 2px of the
 * target, then stops. The window is short (SETTLE_MS) — long enough to outlast a
 * pin re-measure, too short to be felt as the page fighting you.
 *
 * Bails the moment the reader touches the page: a restore that fights a live
 * wheel gesture is worse than one that lands short.
 */
function restoreTo(y: number) {
  if (y <= 0) {
    applyScroll(0);
    return;
  }

  let done = false;
  const cancel = () => {
    done = true;
  };
  const passive = { passive: true } as const;
  // Every way a reader can take the scroll back: wheel/trackpad, touch, keys,
  // and a pointer press (a scrollbar drag emits no wheel event).
  addEventListener("wheel", cancel, passive);
  addEventListener("touchstart", cancel, passive);
  addEventListener("pointerdown", cancel, passive);
  addEventListener("keydown", cancel);
  const unbind = () => {
    removeEventListener("wheel", cancel);
    removeEventListener("touchstart", cancel);
    removeEventListener("pointerdown", cancel);
    removeEventListener("keydown", cancel);
  };

  const started = performance.now();
  const apply = () => {
    const max = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    applyScroll(Math.min(y, max));
    return Math.abs((window.scrollY || 0) - Math.min(y, max)) <= 2 && max >= y - 2;
  };

  // Synchronously first — the common case lands here and never sees a frame.
  if (apply()) {
    unbind();
    return;
  }

  const tick = () => {
    if (done || apply() || performance.now() - started > SETTLE_MS) {
      done = true;
      unbind();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * Start tracking. Idempotent, and safe to call from an effect — everything it
 * touches is client-only.
 */
/** Pin the current entry's offset and stop tracking until the route commits. */
function freeze() {
  const y = window.scrollY || 0;
  if (currentKey) positions.set(currentKey, y);
  byPath.set(location.pathname, y);
  navigating = true;
}

export function installScrollRestore() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  lastPath = location.pathname;
  currentKey = readKey() ?? stampKey();

  // Passive scroll tracking. Lenis scrolls the real window, so its smoothed
  // scroll fires this too — no separate Lenis subscription needed.
  addEventListener(
    "scroll",
    () => {
      // Mid-navigation: this scroll belongs to the router, not to the reader.
      if (navigating) return;
      const y = window.scrollY || 0;
      if (currentKey) {
        // Re-stamp if the router has overwritten our id (see byPath above).
        // Rare, so this is not a replaceState per scroll event.
        if (readKey() !== currentKey) {
          history.replaceState(
            { ...(history.state ?? {}), [STATE_KEY]: currentKey },
            "",
          );
        }
        positions.set(currentKey, y);
      }
      byPath.set(location.pathname, y);
    },
    { passive: true },
  );

  // The App Router scrolls the new route to the top ITSELF, and on a cold route
  // that scroll lands in the gap between the click and the commit — i.e. while
  // the outgoing entry is still the current one, so the tracker above recorded a
  // 0 over the offset the reader actually left behind. Measured: warm
  // navigations restored correctly, the first navigation of a session did not,
  // which is exactly that gap being wide enough to see.
  //
  // Wrapping history.pushState looks like the hook for this and is NOT: the App
  // Router captures the original method at init and calls that reference for its
  // own navigations, so a wrapper installed afterwards never runs (verified —
  // the freeze never fired). The click is the one moment we can rely on.
  //
  // Capture phase, on the document, so it lands before React's handler and
  // before the router does anything. Every internal navigation on this site goes
  // through <AnchorLink> (the only next/link in the tree), but matching the
  // anchor rather than the component keeps this true for any link added later.
  addEventListener(
    "click",
    (e) => {
      const ev = e as MouseEvent;
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) {
        return; // open-in-new-tab and friends: this document isn't going anywhere
      }
      const el = ev.target instanceof Element ? ev.target.closest("a[href]") : null;
      if (!el) return;
      const url = new URL((el as HTMLAnchorElement).href, location.href);
      if (url.origin !== location.origin) return;
      // Same-path (a hash link) doesn't change entries, and the reader's own
      // glide to the section SHOULD keep being recorded.
      if (url.pathname === location.pathname) return;
      freeze();
    },
    { capture: true },
  );

  // A click that ends up navigating nowhere would otherwise leave the tracker
  // frozen: any real scrolling by the reader releases it.
  const thaw = () => {
    navigating = false;
  };
  addEventListener("wheel", thaw, { passive: true });
  addEventListener("touchstart", thaw, { passive: true });
  addEventListener("keydown", thaw);

  addEventListener("popstate", () => {
    // history.state is already the DESTINATION entry's here. A missing id means
    // the router overwrote it (see byPath) — give the entry a fresh one so it
    // tracks from here on, and read the offset out of the path fallback.
    navigating = false;
    const key = readKey() ?? stampKey();
    currentKey = key;
    const y = positions.get(key) ?? byPath.get(location.pathname) ?? 0;

    if (location.pathname === lastPath) {
      // Nothing will re-render (a hash entry) — no commit to wait for.
      restoreTo(y);
      return;
    }
    pending = { y, path: location.pathname, at: performance.now() };
  });
}

/**
 * Take the offset parked by a cross-route pop, or null if this route change was
 * a forward navigation (link click) and should land at the top as usual.
 *
 * Matched on the destination pathname rather than on a timer: the route effect
 * fires whenever the App Router finishes committing, which on a cold route is
 * however long the RSC payload takes. A pop that doesn't match the committing
 * route is LEFT parked — its own commit may still be coming (two rapid pops) —
 * and only the TTL backstop discards it.
 */
export function consumePendingPop(pathname: string): number | null {
  const p = pending;
  if (!p) return null;
  if (performance.now() - p.at > PENDING_TTL_MS) {
    pending = null;
    return null;
  }
  if (p.path !== pathname) return null;
  pending = null;
  return p.y;
}

/** Restore to `y` — the route effect's half of a cross-route pop. */
export function restoreScroll(y: number) {
  restoreTo(y);
}

/** A route change committed: tracking resumes, attributed to the new entry. */
export function noteRouteChange(pathname: string) {
  lastPath = pathname;
  navigating = false;
  // Adopt the entry's own id, minting one if the router's entry has none yet.
  currentKey = readKey() ?? stampKey();
}

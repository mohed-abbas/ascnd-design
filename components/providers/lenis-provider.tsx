"use client";

import { ReactLenis, type LenisRef } from "lenis/react";
import type Lenis from "lenis";
import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Silence the upstream `THREE.Clock` deprecation notice emitted by
// @react-three/fiber's internal store. We use no deprecated three APIs
// ourselves; R3F simply hasn't migrated to THREE.Timer yet. Patched once,
// before the (lazy) cloud canvas mounts. The window flag prevents the wrapper
// from stacking across Fast Refresh.
declare global {
  interface Window {
    __threeClockWarnSilenced?: boolean;
  }
}
if (typeof window !== "undefined" && !window.__threeClockWarnSilenced) {
  window.__threeClockWarnSilenced = true;
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("THREE.Clock")) return;
    originalWarn(...args);
  };
}

/**
 * Root smooth-scroll provider. Sets up a single global Lenis instance and the
 * industry-standard GSAP integration: Lenis drives ScrollTrigger updates, and
 * GSAP's ticker drives Lenis' rAF (one loop, no competing schedulers).
 *
 * `options.autoRaf: false` hands the rAF to GSAP. ScrollTrigger is registered
 * inside the effect so nothing touches `window` during SSR.
 *
 * ⚠️ NOT MOUNTED ON TOUCH DEVICES — see the `isTouch` note below. Lenis smooths
 * the WHEEL; on a phone it is pure overhead, and expensive overhead at that.
 */
export default function LenisProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const lenisRef = useRef<LenisRef>(null);

  /**
   * Is the PRIMARY input a coarse pointer (phone / tablet)? If so, Lenis is
   * never instantiated at all.
   *
   * Lenis' default `syncTouch` is false, which means it does NOT smooth touch
   * scrolling — it detects the touch, sets `isScrolling = "native"`, stops its
   * own animation and hands the gesture straight back to the browser
   * (lenis.mjs:588-592). So on a phone it delivers no scroll feel whatsoever.
   * What it still does, unconditionally, is:
   *
   *   • attach `touchstart` / `touchmove` / `touchend` / `wheel` to
   *     documentElement with `{ passive: false }` (lenis.mjs:283-286, options
   *     at :255). A non-passive touchmove on the scroll root forces the
   *     browser to consult the main thread before it can scroll — the textbook
   *     cause of touch-scroll stutter, and it applies to every gesture on the
   *     page whether or not anything is animating.
   *   • run `event.composedPath()` + `.slice()` + `.find()` over the whole
   *     ancestor chain on EVERY touchmove (lenis.mjs:578-583) before taking
   *     that early return — a fresh array allocation per move event.
   *
   * Zero benefit, two real costs, so we skip it. `(pointer: coarse)` and not
   * a width breakpoint on purpose: it asks "does this device scroll by finger",
   * which is the actual question. A touchscreen laptop reports `pointer: fine`
   * (its trackpad is primary) and correctly keeps its smooth wheel scroll.
   *
   * Nothing downstream breaks without an instance. `useLenis()` returns
   * undefined and all three consumers already guard: anchor-link.tsx and
   * back-to-top.tsx fall back to native `scrollTo({behavior:"smooth"})` /
   * `scrollIntoView`, and intro.tsx optional-chains its stop()/start() (and no
   * longer plays on phones anyway). ScrollTrigger does not need the Lenis pump
   * either — it attaches its own scroll listener to the scroller; the
   * `lenis.on("scroll", …)` bridge below exists only because Lenis' smoothed
   * scroll does not emit native scroll events.
   *
   * Read once in a lazy initialiser rather than through useSyncExternalStore:
   * `<ReactLenis root>` renders NO host element (lenis-react.mjs:116 — with
   * `root` it returns the children directly), so both branches produce
   * byte-identical DOM and hydration cannot mismatch. A store would only add a
   * transient mount-then-unmount of a real Lenis instance on phones. Locked at
   * mount, matching how every other heavy feature here decides.
   */
  const [isTouch] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches,
  );

  // Stable options: an inline literal changes identity on every render, which
  // makes ReactLenis tear down and recreate the Lenis instance. That orphans the
  // ticker's raf onto a dead instance while the live one is never driven — so
  // nothing scrolls. Memoising keeps one instance.
  //
  // `autoRaf: false` hands the rAF to GSAP's ticker (see effect below).
  // `duration: 1.8` lengthens the scroll-smoothing time constant (Lenis default
  // is 1.2) for a heavier, more gliding feel — paired with Lenis' default
  // easeOutExpo curve, which decelerates long and soft at this duration.
  const options = useMemo(() => ({ autoRaf: false, duration: 1.8 }), []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    // On phones the URL bar collapsing/expanding during a fling fires a
    // viewport resize, and ScrollTrigger's default response is a full
    // refresh(): every trigger re-measures mid-scroll (a main-thread stall)
    // and scrubbed elements visibly snap as they re-seed. Ignore those
    // touch-device height-only resizes; real rotations/resizes still refresh.
    ScrollTrigger.config({ ignoreMobileResize: true });

    // Drive Lenis from GSAP's ticker (one loop, no competing schedulers). Read
    // the instance LAZILY every frame instead of capturing it once: the ref may
    // not be populated when this effect first runs (ReactLenis creates the
    // instance in its own effect), and if we bail or capture a stale reference,
    // Lenis never gets its raf and the page freezes. Re-bind ScrollTrigger.update
    // whenever the instance identity changes so cloud parallax stays in sync.
    let bound: Lenis | null = null;
    let update: ((time: number) => void) | null = null;
    if (!isTouch) {
      update = (time: number) => {
        const lenis = lenisRef.current?.lenis;
        if (!lenis) return;
        if (bound !== lenis) {
          bound?.off("scroll", ScrollTrigger.update);
          lenis.on("scroll", ScrollTrigger.update);
          bound = lenis;
        }
        lenis.raf(time * 1000); // ms — Lenis expects the raw rAF timestamp
      };

      gsap.ticker.add(update);
      // lagSmoothing(0) is the documented GSAP+Lenis pairing: Lenis already
      // bounds frame-to-frame scroll deltas, so GSAP must not ALSO clamp them
      // or the two smoothings fight and scrubs drift behind the scroller.
      // Deliberately NOT applied on touch: with Lenis absent there is nothing
      // bounding the delta, and GSAP's default (clamp any frame over 500ms to
      // 33ms) is exactly the protection a phone wants — it stops a GC pause or
      // a backgrounded tab from making the marquee/conveyor lurch forward on
      // the next frame. It only engages on stalls that are already visible.
      gsap.ticker.lagSmoothing(0);
    }

    // Layout-height watchdog. ScrollTrigger re-measures on window resize, but
    // NOT when the DOM alone changes the page height — the plan-compare / FAQ
    // accordions (pure-CSS grid-rows transitions, no JS hook) and the Cal.com
    // embed all grow the document after the triggers below them measured,
    // leaving stale start/pin positions (symptom: the pinned timeline
    // overlapping a freshly-expanded plan-compare). Watch the body's height
    // and refresh once layout settles — debounced past the 300ms accordion
    // transition so a toggle costs ONE refresh, not one per animation frame.
    // The first observe-fire only seeds the baseline, and refresh() nudging
    // the height itself (pin spacers) re-enters harmlessly: the debounce
    // collapses it and the height check ignores no-ops.
    let lastBodyH = 0;
    let lastViewportH = window.innerHeight;
    let refreshTid: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver((entries) => {
      const h = Math.round(entries[0].contentRect.height);
      if (h === lastBodyH) return;
      const seeding = lastBodyH === 0;
      lastBodyH = h;
      if (seeding) return;

      // Was the body's height driven by the DOM, or by the VIEWPORT changing
      // underneath it? Half this page is sized in `dvh` (hero, why-stay,
      // pills, the portfolio globe band, comparison, testimonials), so when a
      // phone's URL bar collapses mid-fling every one of those sections
      // genuinely changes height and the body with them — firing a full
      // ScrollTrigger.refresh() that re-measures every trigger and re-seeds the
      // why-stay pin, on the main thread, during the scroll that caused it.
      // That is a stutter you can only ever feel on a real device: desktop has
      // no URL bar, so DevTools device emulation never reproduces it.
      //
      // innerHeight is the discriminator. If it moved, this is a viewport
      // resize and ScrollTrigger's OWN resize handling already owns the
      // decision — including ignoreMobileResize above, which is precisely the
      // "don't refresh on a touch device's vertical-only resize" policy this
      // observer was accidentally overriding. If innerHeight is unchanged but
      // the body grew, it is a real DOM change (the plan-compare / FAQ
      // accordions, the Cal.com embed) and that is what this watchdog is for.
      const vh = window.innerHeight;
      if (vh !== lastViewportH) {
        lastViewportH = vh;
        return;
      }

      clearTimeout(refreshTid);
      refreshTid = setTimeout(() => ScrollTrigger.refresh(), 200);
    });
    ro.observe(document.body);

    return () => {
      if (update) gsap.ticker.remove(update);
      bound?.off("scroll", ScrollTrigger.update);
      ro.disconnect();
      clearTimeout(refreshTid);
    };
  }, [isTouch]);

  // Touch: render the tree bare. `<ReactLenis root>` emits no host element of
  // its own, so this is the same DOM either way — the only difference is that
  // no Lenis instance, and therefore no non-passive root touch listener, ever
  // exists. Native scrolling is what a phone wanted all along.
  if (isTouch) return <>{children}</>;

  return (
    <ReactLenis root options={options} ref={lenisRef}>
      {children}
    </ReactLenis>
  );
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import gsap from "gsap";
import {
  fullSrc,
  gridSrc,
  type CloudProject,
} from "../cloud-canvas/cloud-canvas-data";
import { setFrozen } from "./grid-freeze";
import { GRID_ASPECT, MAT_RATIO, RADIUS_RATIO, wallForm } from "./grid-spec";

/** Flight time each way. Long enough to read as one object moving, not a cut. */
const FLIGHT = 0.62;
const EASE_OPEN = "power3.inOut";
/** How far the wall recedes behind an open tile. */
const WALL_DIM = 0.3;
/** The unfolding of the crop into the whole design. */
const MORPH = 0.5;
const EASE_MORPH = "power2.inOut";
/** How much of the viewport an open panel may take, on each axis. */
const PANEL_VW = 0.86;
const PANEL_VH = 0.78;
/**
 * Aspect change below which the morph is skipped entirely. A square-ish shot in
 * the square slot is already showing everything it has; tweening 1.00 → 1.02
 * would be a twitch on landing with nothing revealed for it.
 */
const MORPH_EPSILON = 0.02;
/**
 * A SCROLLING panel's width cap. Full-length designs do not get fitted to the
 * screen — see `isScrolling` below — so this is the one number deciding how
 * readable one is: ~1040px is a desktop layout at close to its authored width,
 * and still leaves the wall visible receding on both sides.
 */
const SCROLL_MAX_WIDTH = 1040;

/**
 * Does this project open into a SCROLLING panel rather than a fitted one?
 *
 * Keyed on the authored wall form, not on the decoded aspect. `tall` IS the
 * declaration that a project is a full-length design (grid-spec.ts), so the
 * answer is known at click time — before a single pixel of the full file has
 * arrived — and the panel never has to change its mind about what kind of
 * panel it is halfway through the flight.
 */
function isScrolling(project: CloudProject): boolean {
  return wallForm(project) === "tall";
}

/**
 * GridExpand — clicking a tile in the masonry wall opens it (D5,
 * docs/portfolio-grid-mode.md §15.3).
 *
 * It mirrors the globe's focus rather than inventing a second interaction: one
 * tile leaves the formation and parks centre while everything else recedes. The
 * globe does that with `focusEase` warping a card to FOCUS_Z; here the tile
 * flies from its exact position in the wall to a centred panel.
 *
 * ── TWO STAGES: THE CROP, THEN THE WHOLE DESIGN (D8) ────────────────────────
 * The wall shows every project cover-cropped to its slot aspect — a 16:9 landing
 * page in the 1.577 landscape slot loses its outer edges, a 4:3 mockup in the
 * portrait slot loses 43% of its width. Opening a tile is the moment to give
 * that back, so the panel does NOT simply show the same crop larger:
 *
 *   stage 1  fly from the tile at the TILE's aspect, showing the same crop
 *   stage 2  once the uncropped file has decoded, unfold the panel to the
 *            shot's TRUE aspect — the crop widens into the whole design
 *
 * Why two stages and not one: §19.2. The flight is a uniform scale, which is
 * only exact while the panel carries the tile's aspect; a panel that flew
 * straight to a different shape would need per-axis scaling and would visibly
 * squash the image on the way. Splitting them keeps the flight uniform and puts
 * the aspect change in its own tween, where no scaling is happening at all.
 *
 * The two files are stacked rather than swapped: the wall's cropped tile
 * (already decoded, so it paints on the first frame) sits under the uncropped
 * one, which fades in when it arrives. At stage 1 both are the same crop at the
 * same size, so the hand-off is invisible; without it, clicking a tile would
 * flash an empty white frame while the larger file downloads.
 *
 * The true aspect is read off the decoded image rather than stored in the
 * registry. It is a property OF the file — baking 24 copies of it into
 * cloud-canvas-data.ts would be 24 numbers to re-derive by hand every time an
 * export is re-pulled, and a stale one would size the panel wrong with nothing
 * to catch it. Waiting for the decode is not a cost here: the morph could not
 * start before the pixels exist anyway.
 *
 * ── WHY A DELEGATED NATIVE LISTENER, NOT onClick ────────────────────────────
 * The marquee CLONES each column's tiles to make the loop seamless
 * (grid-marquee.tsx), and at any moment most of the tiles on screen are those
 * clones. They are `cloneNode`d DOM, so they have no React fiber — React's
 * delegated synthetic events never fire for them, and an `onClick` prop on the
 * tile would work on the handful of originals and silently do nothing on every
 * copy. So the click is caught natively on the wall and resolved with
 * `closest("[data-grid-tile]")` + the tile's `data-tile-key`. This is not a
 * style preference; it is the only thing that works for cloned content.
 *
 * ── WHY A PORTAL ────────────────────────────────────────────────────────────
 * The panel renders into `document.body`. Inside the wall it would be clipped
 * by the viewport's `overflow-hidden` AND faded by its edge mask (a mask
 * applies to every descendant), and `position: fixed` would additionally be
 * trapped by any transformed ancestor — the tracks carry `will-change:
 * transform`, which is exactly such a containing block. The portal sidesteps
 * all three.
 *
 * ── THE FLIGHT ──────────────────────────────────────────────────────────────
 * FLIP by hand rather than the Flip plugin: the panel is rendered at its final
 * centred layout, measured, and tweened from the delta to the tile's live rect.
 * `getBoundingClientRect` is already post-transform viewport space, so the
 * drifting track's translate is accounted for with no extra work.
 *
 * The wall does not go dark behind it. Its opacity drops, so the tiles recede
 * INTO the sky — this site's depth cue is toward white/atmosphere, never toward
 * black, which reads muddy over the bright ground (the same rule the engine
 * follows for its own haze, cloud-canvas-engine.ts).
 */
export default function GridExpand({ projects }: { projects: CloudProject[] }) {
  // Which project is expanded. The DOM node it flew from is deliberately NOT
  // state: it is a live element this component mutates (opacity, focus), and a
  // value held in state must never be mutated — the React Compiler lint rules
  // catch exactly that. A ref is the honest home for "the element we are
  // standing in for", and it may well be a CLONE, which is fine: that is where
  // the return flight has to land.
  const [project, setProject] = useState<CloudProject | null>(null);
  /**
   * The decoded shot's true aspect, for the SCROLLING branch only — it has to
   * reach the render (the sheet sizes itself with `aspect-ratio`), where a ref
   * would not trigger one. The fitting branch keeps using `trueAspect` below,
   * which only ever feeds an imperative tween.
   *
   * Null until decode, and the sheet falls back to the tile's aspect until
   * then: at that size the sheet exactly fills the panel, so there is nothing
   * to scroll and nothing to see move.
   */
  const [sheetAspect, setSheetAspect] = useState<number | null>(null);
  const originRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLImageElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Guards the close animation against a second Escape / click landing mid-flight.
  const closing = useRef(false);
  // Stage-2 needs BOTH the flight to have landed and the file to have decoded,
  // and they race. Each writes its own flag and calls the same starter, so
  // whichever finishes second is the one that actually begins the morph.
  const landed = useRef(false);
  const trueAspect = useRef<number | null>(null);
  /** The tile's aspect — the shape the panel opens at and returns to. */
  const tileAspect = useRef(1);

  /**
   * Fit an aspect into the panel's viewport envelope. One rule for both stages,
   * so the only thing that changes between them is the aspect itself.
   */
  const sizeFor = useCallback((aspect: number) => {
    const width = Math.min(
      window.innerWidth * PANEL_VW,
      window.innerHeight * PANEL_VH * aspect,
    );
    return { width, height: width / aspect };
  }, []);

  /**
   * The box a SCROLLING panel opens to. Deliberately NOT `sizeFor(trueAspect)`:
   * fitting a full-length design to the screen is what makes it unreadable.
   *
   * A 1440×4816 page is 0.299, and fitting that into the envelope gives a panel
   * 229px wide on a 1512×982 screen — a sliver you cannot read a headline in,
   * let alone body copy. Fitting is the right rule when the whole shot can be
   * seen at a useful size and the wrong one the moment it cannot, so past a
   * point the panel stops shrinking to fit and starts scrolling instead. Width
   * is chosen for legibility; height is the same envelope every panel uses.
   */
  const scrollBox = useCallback(
    () => ({
      width: Math.min(window.innerWidth * PANEL_VW, SCROLL_MAX_WIDTH),
      height: window.innerHeight * PANEL_VH,
    }),
    [],
  );

  /**
   * The mat is a fraction of the tile edge everywhere else (grid-spec.ts); the
   * panel is not inside a column container, so its `cqw` source doesn't exist
   * here. Same fractions, resolved against the panel's own short edge — which
   * the morph changes, so this is re-applied as it runs.
   */
  const applyMat = useCallback((panel: HTMLElement) => {
    const base = Math.min(panel.offsetWidth, panel.offsetHeight);
    panel.style.setProperty("--tile-mat", `${MAT_RATIO * base}px`);
    panel.style.setProperty("--tile-radius", `${RADIUS_RATIO * base}px`);
  }, []);

  /** Stage 2 — unfold the crop into the whole design. */
  const morph = useCallback(() => {
    const panel = panelRef.current;
    if (!panel || !project || !landed.current || closing.current) return;

    const scrolling = isScrolling(project);
    let to: { width: number; height: number };
    if (scrolling) {
      // A scrolling panel's target is a fixed readable box, so it does NOT
      // depend on the decoded aspect and can open the moment it lands.
      to = scrollBox();
    } else {
      const aspect = trueAspect.current;
      // A fitting panel has nothing to morph TO until the file reports its shape.
      if (aspect == null) return;
      if (Math.abs(aspect - tileAspect.current) < MORPH_EPSILON) return;
      to = sizeFor(aspect);
    }

    gsap.to(panel, {
      width: to.width,
      height: to.height,
      duration: MORPH,
      ease: EASE_MORPH,
      // Width and height, not a transform: the two stages differ in SHAPE, and
      // a non-uniform scale is exactly what would distort the shot. This is one
      // portalled element with no layout dependents, for half a second, once
      // per open — not a per-frame cost the page carries.
      onUpdate: () => applyMat(panel),
      onComplete: () => {
        // Scrollable only once it has arrived. Letting the wheel move the sheet
        // while the panel is still flying would fight the flight for the same
        // pixels, and the return trip aims at a rect measured before either.
        if (scrolling && scrollerRef.current) {
          scrollerRef.current.style.overflowY = "auto";
        }
      },
    });
  }, [applyMat, project, scrollBox, sizeFor]);

  const close = useCallback(() => {
    const panel = panelRef.current;
    const origin = originRef.current;
    if (!origin || !panel || closing.current) return;
    closing.current = true;

    const wall = document.querySelector<HTMLElement>("[data-portfolio-grid]");

    const land = () => {
      origin.style.opacity = "";
      // Focus returns to where the pointer/keyboard left off — the tile the
      // visitor opened, not the top of the document.
      if (origin.isConnected) origin.focus?.({ preventScroll: true });
      originRef.current = null;
      setFrozen(false);
      closing.current = false;
      landed.current = false;
      trueAspect.current = null;
      setProject(null);
    };

    gsap.killTweensOf(panel);

    // REWIND A SCROLLED PANEL AS IT FOLDS. The tile it is returning to shows
    // the TOP of the design (the crop is top-anchored — see TOP_ANCHORED in
    // scripts/build-portfolio-presets.mjs), so a panel closed halfway down a
    // landing page would otherwise fly home showing the testimonials and land
    // on a tile showing the hero — one object visibly becoming a different one.
    //
    // Tweened through a proxy rather than `scrollTop` directly: that is not a
    // CSS property, and routing it through a plain object keeps this working
    // without registering ScrollToPlugin for one tween.
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.style.overflowY = "hidden";
      if (scroller.scrollTop > 0) {
        const rewind = { y: scroller.scrollTop };
        gsap.to(rewind, {
          y: 0,
          duration: FLIGHT,
          ease: EASE_OPEN,
          onUpdate: () => {
            scroller.scrollTop = rewind.y;
          },
        });
      }
    }

    gsap.to(backdropRef.current, { opacity: 0, duration: FLIGHT * 0.8 });
    if (wall) gsap.to(wall, { opacity: 1, duration: FLIGHT, ease: EASE_OPEN });

    // THE ORIGIN CAN BE GONE. It is very often a marquee CLONE, and the marquee
    // destroys and re-creates every clone on each rebuild — which a resize
    // behind an open panel triggers. Flying "home" to a detached node measures
    // a 0×0 rect at the document origin, so the panel would collapse into the
    // top-left corner instead of returning. Fall back to a fade in place: it is
    // a different, gentler exit for a case the visitor caused by resizing, and
    // it is honest about having lost the tile.
    if (!origin.isConnected) {
      gsap.to(panel, {
        opacity: 0,
        scale: 0.94,
        duration: FLIGHT * 0.6,
        ease: "power2.in",
        onComplete: land,
      });
      return;
    }

    // Re-measure: the columns eased to a stop rather than snapping when this
    // opened, so the origin tile kept moving for ~0.4s after the outbound
    // flight began. Returning to the rect captured on the way out would land
    // the tile visibly beside itself.
    const to = origin.getBoundingClientRect();
    const from = panel.getBoundingClientRect();
    // Where the panel will be once it has folded back to the tile's shape. The
    // flight's scale has to be measured against THAT, not against the unfolded
    // width it currently has.
    const folded = sizeFor(tileAspect.current);

    // FOLD AND FLY AT ONCE. The panel is centred by the dialog's flexbox, so
    // shrinking it does not move its centre — which means the centre-to-centre
    // translation below is unaffected by the fold running alongside it, and the
    // two tweens cannot fight. Sequencing them instead would make every close
    // take FLIGHT + MORPH and read as a stall before the tile goes home.
    gsap.to(panel, {
      width: folded.width,
      height: folded.height,
      duration: FLIGHT,
      ease: EASE_OPEN,
      onUpdate: () => applyMat(panel),
    });
    gsap.to(panel, {
      x: to.left + to.width / 2 - (from.left + from.width / 2),
      y: to.top + to.height / 2 - (from.top + from.height / 2),
      scale: to.width / folded.width,
      duration: FLIGHT,
      ease: EASE_OPEN,
      onComplete: land,
    });
  }, [applyMat, sizeFor]);

  // Unmount while a tile is open — a mode switch, or the section leaving the
  // tree. Without this the wall stays at WALL_DIM opacity and, worse, stays
  // FROZEN: the freeze flag is module-scoped precisely so it survives a
  // marquee rebuild, which means nothing else would ever thaw it and the next
  // visit to the grid would render a wall that never moves.
  useEffect(() => {
    return () => {
      if (!originRef.current) return;
      originRef.current.style.opacity = "";
      originRef.current = null;
      setFrozen(false);
      const wall = document.querySelector<HTMLElement>("[data-portfolio-grid]");
      if (wall) gsap.set(wall, { opacity: 1 });
    };
  }, []);

  // ── Delegated open ────────────────────────────────────────────────────────
  useEffect(() => {
    const wall = document.querySelector<HTMLElement>("[data-portfolio-grid]");
    if (!wall) return;

    const onClick = (e: MouseEvent) => {
      // Already expanded, or still flying home — ignore. The ref is the source
      // of truth here rather than the state, because it is cleared only when
      // the return flight actually lands.
      if (originRef.current) return;
      const tile = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-grid-tile]",
      );
      if (!tile) return;
      const hit = projects.find((p) => p.src === tile.dataset.tileKey);
      if (!hit) return;
      originRef.current = tile;
      // Clear the previous shot's shape before the next one decodes, or a
      // scrolling panel would open with the LAST design's aspect baked into
      // its sheet for one frame.
      setSheetAspect(null);
      setProject(hit);
    };

    wall.addEventListener("click", onClick);
    return () => wall.removeEventListener("click", onClick);
  }, [projects]);

  // ── Escape ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!project) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project, close]);

  // ── Resize while open ─────────────────────────────────────────────────────
  // The panel is sized in PIXELS so the morph has something to tween; CSS units
  // would re-fit themselves but cannot be animated between two aspects. The
  // trade is that a resize has to be answered here. Set, never tweened: the
  // viewport is already moving under the visitor, and animating to catch up
  // would lag behind a drag-resize by the tween's duration.
  useEffect(() => {
    if (!project) return;
    const onResize = () => {
      const panel = panelRef.current;
      if (!panel || closing.current) return;
      const to =
        landed.current && isScrolling(project)
          ? scrollBox()
          : sizeFor((landed.current && trueAspect.current) || tileAspect.current);
      gsap.set(panel, { width: to.width, height: to.height });
      applyMat(panel);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [project, sizeFor, scrollBox, applyMat]);

  // ── Stage 1: the outbound flight ──────────────────────────────────────────
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const origin = originRef.current;
    if (!project || !panel || !origin) return;

    setFrozen(true);
    landed.current = false;
    trueAspect.current = null;

    const wall = document.querySelector<HTMLElement>("[data-portfolio-grid]");
    const aspect = GRID_ASPECT[wallForm(project)];
    tileAspect.current = aspect;

    // Size the panel at the TILE's aspect before measuring, so the flight below
    // is a uniform scale (§19.2).
    const open = sizeFor(aspect);
    gsap.set(panel, { width: open.width, height: open.height, x: 0, y: 0, scale: 1, opacity: 1 });
    applyMat(panel);

    const from = origin.getBoundingClientRect();
    const to = panel.getBoundingClientRect();
    const scale = from.width / to.width;

    // Hide the tile the panel is standing in for, or it shows through the
    // faded wall as a duplicate.
    origin.style.opacity = "0";

    // Move focus into the panel. preventScroll because the dialog is a fixed
    // overlay — letting the browser scroll to it would move the page under the
    // wall, and the return flight aims at a rect measured in that page.
    dialogRef.current?.focus({ preventScroll: true });

    gsap.fromTo(
      backdropRef.current,
      { opacity: 0 },
      { opacity: 1, duration: FLIGHT * 0.8 },
    );
    if (wall) {
      gsap.to(wall, { opacity: WALL_DIM, duration: FLIGHT, ease: EASE_OPEN });
    }
    gsap.fromTo(
      panel,
      {
        x: from.left + from.width / 2 - (to.left + to.width / 2),
        y: from.top + from.height / 2 - (to.top + to.height / 2),
        scale,
      },
      {
        x: 0,
        y: 0,
        scale: 1,
        duration: FLIGHT,
        ease: EASE_OPEN,
        onComplete: () => {
          landed.current = true;
          morph();
        },
      },
    );

    // A cached file can finish decoding before React attaches onLoad, in which
    // case that event never fires and stage 2 would never run. next/image
    // checks `complete` itself, but only for the image it owns on mount — this
    // covers the panel being re-opened on a project already in the cache.
    const img = fullRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      const cached = img.naturalWidth / img.naturalHeight;
      trueAspect.current = cached;
      // The scrolling sheet sizes itself from STATE, not from this ref, so it
      // has to be told too — otherwise re-opening an already-cached full-length
      // design would leave the sheet at the tile's aspect and nothing would
      // scroll. `morph()` is not called here: the flight's onComplete is what
      // starts stage 2, and it will find this value waiting.
      setSheetAspect(cached);
      gsap.set(img, { opacity: 1 });
    }
  }, [project, sizeFor, applyMat, morph]);

  /**
   * The uncropped file has decoded. Both branches need the same three things —
   * remember the shape, reveal the layer, start stage 2 — so they share one
   * handler rather than drifting apart.
   */
  const onFullLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!img.naturalWidth) return;
    const aspect = img.naturalWidth / img.naturalHeight;
    trueAspect.current = aspect;
    setSheetAspect(aspect);
    gsap.to(img, { opacity: 1, duration: 0.2 });
    morph();
  };

  if (!project) return null;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={project.name}
      // tabIndex so focus can be MOVED here on open. Without it the keyboard
      // stays parked on the tile button that is now invisible and behind the
      // overlay — Escape would still work, but a screen reader would be
      // reading the wall while a panel covers it. This is not yet a focus
      // TRAP (tab can still reach the controls behind); a trap belongs with the
      // deferred lightbox variant, which is when this becomes a real modal.
      tabIndex={-1}
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-[18px] outline-none"
    >
      {/* Click-out. A transparent catcher rather than a tinted sheet: the wall
          itself does the dimming (by receding, not darkening), so this only
          needs to catch the pointer. */}
      <div
        ref={backdropRef}
        className="absolute inset-0 cursor-pointer"
        onClick={close}
        aria-hidden
      />
      {/* Sized in px by the effects above — no width/aspect in the style here,
          or the first paint would use a different box than the one measured. */}
      <div ref={panelRef} className="relative">
        <div
          aria-hidden
          className="absolute border border-white/40 bg-white/10"
          style={{
            inset: "calc(-1 * var(--tile-mat))",
            borderRadius: "var(--tile-radius)",
            boxShadow: "inset 0 0 var(--tile-mat) 0 rgba(255,255,255,0.28)",
          }}
        />
        <div
          className="relative size-full overflow-hidden bg-white"
          style={{ borderRadius: "var(--tile-radius)" }}
        >
          {/* The wall's cropped tile, already decoded — it paints on the first
              frame so the flight never carries an empty white box. */}
          <Image
            src={gridSrc(project)}
            alt=""
            aria-hidden
            fill
            sizes="86vw"
            className="object-cover"
          />
          {/* The whole design. Identical to the layer beneath at stage 1 (same
              crop, same size), so its fade-in is invisible; the morph is what
              actually reveals it. */}
          {isScrolling(project) ? (
            // SCROLLING BRANCH (D8). The sheet is the full design at the
            // panel's width and its own natural height, top-anchored, in a box
            // that clips it. At stage 1 the panel IS the tile's 0.6 box, and
            // the crop feeding the wall is top-anchored too, so the clipped
            // sheet is pixel-for-pixel the tile the visitor clicked — the two
            // presets are the same source, cut at the same corner. Nothing has
            // to cross-fade; the panel simply gets bigger and then scrolls.
            <div
              ref={scrollerRef}
              // ⚠️ data-lenis-prevent is load-bearing. The page's smooth scroll
              // is a single global Lenis instance that swallows wheel events
              // before the browser sees them (lenis-provider.tsx); without this
              // the wheel over an open panel would scroll the PAGE behind it
              // and the design would never move. Lenis walks the ancestor chain
              // looking for exactly this attribute.
              data-lenis-prevent
              // overflow-hidden until it lands — the morph's onComplete opens
              // it. Scrolling a panel that is still flying would fight the
              // flight for the same pixels.
              className="absolute inset-0 overflow-y-hidden overscroll-contain"
            >
              <div
                className="relative w-full"
                // Falls back to the tile's aspect until the file decodes, at
                // which point the sheet is exactly the panel and there is
                // nothing to scroll yet.
                style={{ aspectRatio: sheetAspect ?? GRID_ASPECT[wallForm(project)] }}
              >
                <Image
                  ref={fullRef}
                  src={fullSrc(project)}
                  alt={project.name}
                  fill
                  // The sheet carries the shot's own aspect, so `cover` crops
                  // nothing — it is `contain` with the box already correct.
                  sizes="86vw"
                  priority
                  className="object-cover opacity-0"
                  onLoad={onFullLoad}
                />
              </div>
            </div>
          ) : (
            <Image
              ref={fullRef}
              src={fullSrc(project)}
              alt={project.name}
              fill
              sizes="86vw"
              priority
              className="object-cover opacity-0"
              onLoad={onFullLoad}
            />
          )}
        </div>
      </div>
      {/* The name, which the wall itself deliberately doesn't show — a tile
          reads as work, a labelled tile reads as a catalogue. Full white
          rather than white/80: it sits over the RECEDED wall, which is pale
          sky plus washed-out tiles, and 80% on that is barely a shade. */}
      <p className="relative text-[15px] lowercase text-white">
        {project.name}
      </p>
    </div>,
    document.body,
  );
}

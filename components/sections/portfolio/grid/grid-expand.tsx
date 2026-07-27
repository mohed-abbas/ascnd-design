"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import gsap from "gsap";
import type { CloudProject } from "../cloud-canvas/cloud-canvas-data";
import { setFrozen } from "./grid-freeze";
import { GRID_ASPECT, MAT_RATIO, RADIUS_RATIO } from "./grid-spec";

/** Flight time each way. Long enough to read as one object moving, not a cut. */
const FLIGHT = 0.62;
const EASE_OPEN = "power3.inOut";
/** How far the wall recedes behind an open tile. */
const WALL_DIM = 0.3;

/**
 * GridExpand — clicking a tile in the masonry wall opens it (D5,
 * docs/portfolio-grid-mode.md §15.3).
 *
 * It mirrors the globe's focus rather than inventing a second interaction: one
 * tile leaves the formation and parks centre while everything else recedes. The
 * globe does that with `focusEase` warping a card to FOCUS_Z; here the tile
 * flies from its exact position in the wall to a centred panel.
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
 * centred layout, measured, and tweened from the delta to the tile's live
 * rect. `getBoundingClientRect` is already post-transform viewport space, so
 * the drifting track's translate is accounted for with no extra work, and
 * because the panel keeps the tile's ASPECT the scale is uniform — the shot
 * never distorts in flight. That aspect constraint is what makes the simple
 * version correct; a panel of a different shape would need the plugin's
 * per-axis handling and would squash the image on the way.
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
  const originRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  // Guards the close animation against a second Escape / click landing mid-flight.
  const closing = useRef(false);

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
      setProject(null);
    };

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

    gsap.to(panel, {
      x: to.left + to.width / 2 - (from.left + from.width / 2),
      y: to.top + to.height / 2 - (from.top + from.height / 2),
      scale: to.width / from.width,
      duration: FLIGHT,
      ease: EASE_OPEN,
      onComplete: land,
    });
  }, []);

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

  // ── The outbound flight ───────────────────────────────────────────────────
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const origin = originRef.current;
    if (!project || !panel || !origin) return;

    setFrozen(true);

    const wall = document.querySelector<HTMLElement>("[data-portfolio-grid]");
    const from = origin.getBoundingClientRect();
    const to = panel.getBoundingClientRect();
    // Uniform scale — the panel carries the tile's aspect, so one number is
    // exact on both axes and the shot cannot stretch in flight.
    const scale = from.width / to.width;

    // The mat is a fraction of the tile edge everywhere else (grid-spec.ts);
    // the panel is not inside a column container, so its `cqw` source doesn't
    // exist here. Same fractions, resolved against the panel's own short edge.
    const base = Math.min(to.width, to.height);
    panel.style.setProperty("--tile-mat", `${MAT_RATIO * base}px`);
    panel.style.setProperty("--tile-radius", `${RADIUS_RATIO * base}px`);

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
      { x: 0, y: 0, scale: 1, duration: FLIGHT, ease: EASE_OPEN },
    );
  }, [project]);

  if (!project) return null;

  const aspect = GRID_ASPECT[project.grid?.form ?? project.form];

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
      <div
        ref={panelRef}
        className="relative"
        style={{
          // Fit the viewport on whichever axis binds first, keeping the tile's
          // aspect exactly — see the header on why uniform scale matters.
          width: `min(86vw, ${78 * aspect}dvh)`,
          aspectRatio: aspect,
        }}
      >
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
          <Image
            src={project.grid?.src ?? project.src}
            alt={project.name}
            fill
            // The one place the work is actually being LOOKED at, so ask for
            // the biggest source rather than the wall's column width.
            sizes="86vw"
            priority
            className="object-cover"
          />
        </div>
      </div>
      {/* The name, which the wall itself deliberately doesn't show — a tile
          reads as work, a labelled tile reads as a catalogue. */}
      <p className="relative text-[15px] lowercase text-white/80">
        {project.name}
      </p>
    </div>,
    document.body,
  );
}

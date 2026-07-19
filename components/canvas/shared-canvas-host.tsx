"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { PLANES, type PlaneName } from "./plane-config";
import { getPlaneCount, subscribePlane } from "./view-registry";

// The actual <Canvas> host (pulls in three/drei) is client-only and loaded ONLY
// when a plane has ≥1 view — so on the homepage (no views registered anywhere)
// this chunk is never even downloaded, and no GL context is created. ssr:false
// must live in a Client Component (Next 16 disallows it in Server Components),
// which is why this thin layer exists.
const PlaneCanvas = dynamic(() => import("./plane-canvas"), { ssr: false });

// Hydration gate: false for SSR + the first client render, true right after.
// Matches CloudLayer — SSR renders nothing (getPlaneServerSnapshot is empty
// anyway), and the client re-evaluates after hydration with no mismatch.
const noopSubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Gate + mount for ONE plane. Subscribes to the plane's view count (a light,
 * three-free store read) and mounts the <Canvas> host only while count > 0. When
 * it drops back to 0 the host unmounts and the GL context is released.
 */
function PlaneGate({ plane }: { plane: PlaneName }) {
  const hydrated = useHydrated();
  const count = useSyncExternalStore(
    (cb) => subscribePlane(plane, cb),
    () => getPlaneCount(plane),
    () => 0,
  );

  // WARM LATCH (M4): once this plane's Canvas has mounted, keep it mounted for
  // the rest of the session — even if the view count momentarily returns to 0.
  // Phase 2's intro→hero handoff transits through count 0 (intro view unregisters
  // before the next view registers); without the latch that would destroy the GL
  // context and force an expensive recreate hitch mid-handoff. Chosen over a
  // timed grace period for simplicity; SSR-safe (starts false, set only in a
  // client effect after hydration). Costs an idle, cleared context while a latched
  // plane sits empty — acceptable, and it NEVER latches on pages that register no
  // views (the homepage keeps zero GL contexts).
  // Latched via the sanctioned conditional-setState-during-render idiom (no
  // effect, so it never trips react-hooks/set-state-in-effect).
  const [latched, setLatched] = useState(false);
  if (count > 0 && !latched) setLatched(true);

  if (!hydrated) return null;
  if (count === 0 && !latched) return null;
  return <PlaneCanvas plane={plane} />;
}

/**
 * SharedCanvasHost — mounted once at the root (app/layout.tsx). Renders one gate
 * per configured plane (data-driven from PLANE_CONFIG). With zero views
 * registered — the state on every page except the lab demo, which is the only
 * caller of useSharedView so far — it renders NO <Canvas>, downloads no R3F
 * chunk, and adds ~zero runtime cost. Phase 1 is invisible on the live site by
 * construction.
 */
export default function SharedCanvasHost() {
  return (
    <>
      {PLANES.map((plane) => (
        <PlaneGate key={plane} plane={plane} />
      ))}
    </>
  );
}

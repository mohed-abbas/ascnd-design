/**
 * The intro scene's camera + plane depths — a LEAF module on purpose.
 *
 * These three numbers are shared by <Intro> (which measures the DOM in CSS px
 * and converts to world units) and <IntroScene> (which renders at those depths).
 * They used to live in intro-scene.tsx, and <Intro> imported them from there as
 * runtime values:
 *
 *     import { CAMERA_Z, ROCK_Z, TILE_Z } from "./intro-scene";   // ← the bug
 *
 * A value import is a STATIC edge, so it pulled intro-scene.tsx — and with it
 * three, @react-three/fiber and @react-three/drei — into <Hero>'s static module
 * graph. The `dynamic(() => import("./intro-scene"), { ssr: false })` right
 * below it then had nothing left to defer: the homepage shipped ~950KB of
 * WebGL JS in its initial chunks (an 852KB three core chunk among them) on
 * EVERY device, including phones where the welcome no longer plays at all and
 * no GL context is ever created. /pricing, which has no intro, shipped none of
 * it — that asymmetry is what gave the problem away.
 *
 * Keeping them here means intro-scene.tsx is reachable ONLY through the
 * dynamic() edge, so the WebGL bundle is genuinely code-split again.
 *
 * ⚠️ Do not re-export these from intro-scene.tsx, and never import a runtime
 * value from it outside the dynamic import — either would silently restore the
 * static edge. `import type` is always safe (types are erased).
 */

/**
 * Camera distance. Paired with the scene's telephoto fov so the z=0 plane spans
 * exactly 8.284 world units vertically — the constant <Intro> divides by
 * innerHeight to get its px→world scale (`wpp`).
 */
export const CAMERA_Z = 40;

/**
 * The rock planes sit slightly BEHIND the glass so it refracts them. A point at
 * this depth projects a touch toward screen centre versus the z=0 mapping
 * <Intro> measures with, so <Intro> scales the rock coords by
 * (CAMERA_Z − ROCK_Z) / CAMERA_Z to land them on exactly the measured DOM rect —
 * flush to the viewport edges, no sky gap past the cliff.
 */
export const ROCK_Z = -0.3;

/**
 * The shot tiles: also behind the glass (refracted), a hair in FRONT of the
 * rocks. <Intro> applies the same projection compensation so each tile lands
 * pixel-exact on the DOM shot it crossfades to.
 */
export const TILE_Z = -0.2;

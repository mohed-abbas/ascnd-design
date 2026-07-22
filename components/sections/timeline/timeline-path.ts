/**
 * Geometry for the "your first month, plotted" timeline (Figma frame 746:4125).
 *
 * The winding dotted spine and the milestone dots that sit on it, all expressed
 * in the section's 1512×943 FRAME coordinate space so the SVG (viewBox
 * "0 0 1512 943") and the absolutely-positioned HTML cards share one grid.
 *
 * The raw path (Figma vector 746:4087) is authored in its own local space; its
 * node sits at frame (−43, 71). `PATH_TRANSFORM` shifts the local `d` into frame
 * coords (local min-x −41 → frame −43 ⇒ −2; local min-y 0.34 → frame 71 ⇒ +70.66),
 * so the drawn curve lines up exactly under the dots below (which are already in
 * frame coords, straight from Figma).
 */

// Design frame the whole composition is mapped to (drives the SVG viewBox and the
// aspect-ratio of the scalable stage).
export const FRAME = { w: 1512, h: 943 } as const;

// The dotted spine — Figma vector 746:4087, verbatim. `stroke-dasharray 6 6`
// (the visible dots) is applied where it's drawn; here we only carry the shape.
export const PATH_D =
  "M-41 367.844L214.12 622.964C268.25 677.094 350.161 692.223 420.055 660.999C495.698 627.208 539.586 547.182 527.417 465.233L500.922 286.812C483.338 168.397 565.677 58.3603 684.243 41.8238C770.887 29.7395 856.235 71.2568 900.213 146.882L1047.29 399.798C1069.64 438.227 1107.66 464.973 1151.38 473.016C1264.33 493.794 1358.76 386.832 1324.13 277.332L1319.14 261.524C1306.24 220.731 1309.97 176.494 1329.53 138.442L1400.5 0.34375";

// Local → frame shift for the path (see file header).
export const PATH_TRANSFORM = "translate(-2 70.66)";

/**
 * The dots that ride the spine, in frame coords (cx/cy = centre, r = radius).
 * `beat` names a milestone dot (its card reveals off it); the unnamed small dots
 * are decorative in-between beats. Order is start→end along the curve, which is
 * also the order the draw-head reaches them — Phase 2 keys the pop timing off this.
 */
export type Dot = {
  cx: number;
  cy: number;
  r: number;
  beat?: "subscribe" | "first-request" | "delivery" | "revised" | "pause";
};

export const DOTS: readonly Dot[] = [
  { cx: 156, cy: 637, r: 6, beat: "subscribe" }, // day 1
  { cx: 442, cy: 719, r: 6, beat: "first-request" }, // day 2
  { cx: 521.5, cy: 512.5, r: 3.5 }, // deco
  { cx: 547, cy: 189, r: 6, beat: "delivery" }, // day 5
  { cx: 884.5, cy: 197.5, r: 3.5 }, // deco (near "designs in review")
  { cx: 1021, cy: 429, r: 6, beat: "revised" }, // day 12
  { cx: 1185, cy: 546, r: 6, beat: "pause" }, // day 23
  { cx: 1309.5, cy: 298.5, r: 3.5 }, // deco (final rise)
];

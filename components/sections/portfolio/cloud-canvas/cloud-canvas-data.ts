/**
 * CloudCanvas project registry — the single place you author the portfolio set.
 *
 * Each entry is one project tile on the globe. You control, per project:
 *   • `form` — which tile slot it renders in (landscape / square / portrait).
 *     Honoured when the config's layout is "manual" (the shipped portfolio
 *     preset). Images are cover-cropped into the slot, so any form works for
 *     any image — pick whatever frames the shot best.
 *   • `type` — which filter tab it belongs to (web / branding / misc). The
 *     section's tabs filter the globe by this; "all" shows everything.
 *   • `name` — shown in the focus/hover label (added in a later pass).
 *
 * The images live in public/portfolio/cloud/ (≤520px WebP — run
 * `npm run optimize:portfolio` after dropping new ones in). Keep filenames
 * URL-clean (no spaces). Order here is the order tiles are laid onto the
 * formation — reorder entries to reshuffle neighbours.
 *
 * The uncropped Figma exports these were made from live in portfolio-src/ (repo
 * root, deliberately OUTSIDE public/ so they are never served); the Figma node
 * IDs are recorded in portfolio-src/SOURCES.md so any frame can be re-pulled.
 *
 * STATUS: the `web` and `branding` sets are real (slug filenames, from the Figma
 * "Design shortlist" → webdesigns / BrandingTiles). The remaining six `cloud-NN`
 * entries are still PLACEHOLDERS from the Figma "Startup" collage, awaiting the
 * misc export — their names are invented and their forms seeded from natural
 * aspect.
 */

export type ProjectType = "web" | "branding" | "misc";
export type ProjectForm = "landscape" | "square" | "portrait";
/** A filter tab value: a project type, or "all" (the default tab). */
export type CloudFilter = ProjectType | "all";

export interface CloudProject {
  src: string;
  /** Shown in the focus/hover label (added in a later pass). */
  name: string;
  /** Filter-tab bucket. */
  type: ProjectType;
  /** Tile slot shape — used when the config's layout is "manual". */
  form: ProjectForm;
}

/** The filter tabs, in display order. Labels are UI copy (house lowercase). */
export const PROJECT_FILTERS: { value: CloudFilter; label: string }[] = [
  { value: "all", label: "all" },
  { value: "web", label: "web designs" },
  { value: "branding", label: "brandings" },
  { value: "misc", label: "misc" },
];

const dir = "/portfolio/cloud";

// Entries rotate web → branding → misc rather than sitting in per-type blocks:
// registry order IS formation order, so a contiguous run would clump one type
// (and one tile shape) on a single face of the globe.
//
// Physical-object mockups file under `misc`, not under the discipline they
// present — a keycap render or a cloth tag is a photograph OF branding, not the
// branding itself, and they read as scene renders next to flat artwork.
export const cloudProjects: CloudProject[] = [
  { src: `${dir}/tasktrox-landing.webp`, name: "Tasktrox", type: "web", form: "landscape" },
  { src: `${dir}/emerald-mark.webp`, name: "Emerald Psychiatry", type: "branding", form: "portrait" },
  { src: `${dir}/cloth-tag-mockup.webp`, name: "cloth tag mockup", type: "misc", form: "square" },
  { src: `${dir}/kalinka.webp`, name: "Kalinka", type: "web", form: "landscape" },
  { src: `${dir}/emerald-poster-mind.webp`, name: "Emerald Psychiatry — your mind matters", type: "branding", form: "portrait" },
  { src: `${dir}/cloud-27.webp`, name: "Project 27", type: "misc", form: "square" },
  { src: `${dir}/medlink.webp`, name: "Medlink", type: "web", form: "landscape" },
  // Pre-cropped by scripts/optimize-portfolio-images.mjs (CROPS), not centred:
  // a centred cut into the portrait slot bisects the emerald wordmark.
  { src: `${dir}/emerald-poster-help.webp`, name: "Emerald Psychiatry — ask for help", type: "branding", form: "portrait" },
  { src: `${dir}/cloud-07.webp`, name: "Project 07", type: "misc", form: "portrait" },
  { src: `${dir}/crypkit.webp`, name: "CrypKit", type: "web", form: "landscape" },
  { src: `${dir}/elyv-logo.webp`, name: "ElyV", type: "branding", form: "square" },
  { src: `${dir}/cloud-15.webp`, name: "Project 15", type: "misc", form: "portrait" },
  { src: `${dir}/dubai-blueprint.webp`, name: "Dubai Blueprint", type: "web", form: "landscape" },
  { src: `${dir}/emerald-poster-ohio.webp`, name: "Emerald Psychiatry — telehealth", type: "branding", form: "portrait" },
  { src: `${dir}/keycap-mockup.webp`, name: "keycap mockup", type: "misc", form: "landscape" },
  { src: `${dir}/tasktrox-webapp.webp`, name: "Tasktrox — web app", type: "web", form: "landscape" },
  { src: `${dir}/circle-mark.webp`, name: "circle mark", type: "branding", form: "square" },
  { src: `${dir}/cloud-16.webp`, name: "Project 16", type: "misc", form: "portrait" },
  { src: `${dir}/operations-dashboard.webp`, name: "operations dashboard", type: "web", form: "landscape" },
  // `square` (not landscape) on purpose: the 4:3 source centre-crops to 1:1
  // around the monitor and drops the empty studio floor, which frames it
  // tighter AND breaks up an otherwise all-landscape web set.
  { src: `${dir}/monitor-mockup.webp`, name: "monitor mockup", type: "misc", form: "square" },
  { src: `${dir}/crypto-scratchers.webp`, name: "crypto scratchers", type: "web", form: "landscape" },
  { src: `${dir}/cloud-18.webp`, name: "Project 18", type: "misc", form: "portrait" },
  { src: `${dir}/performance-consultancy.webp`, name: "performance consultancy", type: "web", form: "landscape" },
  { src: `${dir}/cloud-28.webp`, name: "Project 28", type: "misc", form: "portrait" },
  { src: `${dir}/fashion-storefront.webp`, name: "fashion storefront", type: "web", form: "landscape" },
];

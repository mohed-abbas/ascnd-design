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
 * The images live in public/portfolio/cloud/ (≤900px WebP). Keep filenames
 * URL-clean (no spaces). Order here is the order tiles are laid onto the
 * formation — reorder entries to reshuffle neighbours.
 *
 * NOTE: names and types below are PLACEHOLDERS (the stills came from the Figma
 * "Startup" collage) — replace them with the real project data. Forms were
 * seeded from each image's natural aspect, with a few squares for rhythm.
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

export const cloudProjects: CloudProject[] = [
  { src: `${dir}/cloud-01.webp`, name: "Project 01", type: "web", form: "landscape" },
  { src: `${dir}/cloud-02.webp`, name: "Project 02", type: "branding", form: "portrait" },
  { src: `${dir}/cloud-03.webp`, name: "Project 03", type: "branding", form: "square" },
  { src: `${dir}/cloud-04.webp`, name: "Project 04", type: "web", form: "landscape" },
  { src: `${dir}/cloud-05.webp`, name: "Project 05", type: "web", form: "landscape" },
  { src: `${dir}/cloud-06.webp`, name: "Project 06", type: "web", form: "landscape" },
  { src: `${dir}/cloud-07.webp`, name: "Project 07", type: "misc", form: "portrait" },
  { src: `${dir}/cloud-08.webp`, name: "Project 08", type: "web", form: "landscape" },
  { src: `${dir}/cloud-09.webp`, name: "Project 09", type: "branding", form: "square" },
  { src: `${dir}/cloud-10.webp`, name: "Project 10", type: "web", form: "landscape" },
  { src: `${dir}/cloud-11.webp`, name: "Project 11", type: "web", form: "landscape" },
  { src: `${dir}/cloud-12.webp`, name: "Project 12", type: "web", form: "landscape" },
  { src: `${dir}/cloud-13.webp`, name: "Project 13", type: "branding", form: "portrait" },
  { src: `${dir}/cloud-14.webp`, name: "Project 14", type: "branding", form: "portrait" },
  { src: `${dir}/cloud-15.webp`, name: "Project 15", type: "misc", form: "portrait" },
  { src: `${dir}/cloud-16.webp`, name: "Project 16", type: "misc", form: "portrait" },
  { src: `${dir}/cloud-17.webp`, name: "Project 17", type: "branding", form: "square" },
  { src: `${dir}/cloud-18.webp`, name: "Project 18", type: "misc", form: "portrait" },
  { src: `${dir}/cloud-19.webp`, name: "Project 19", type: "web", form: "landscape" },
  { src: `${dir}/cloud-20.webp`, name: "Project 20", type: "web", form: "landscape" },
  { src: `${dir}/cloud-21.webp`, name: "Project 21", type: "branding", form: "portrait" },
  { src: `${dir}/cloud-22.webp`, name: "Project 22", type: "web", form: "landscape" },
  { src: `${dir}/cloud-23.webp`, name: "Project 23", type: "branding", form: "square" },
  { src: `${dir}/cloud-24.webp`, name: "Project 24", type: "web", form: "landscape" },
  { src: `${dir}/cloud-25.webp`, name: "Project 25", type: "web", form: "landscape" },
  { src: `${dir}/cloud-26.webp`, name: "Project 26", type: "web", form: "landscape" },
  { src: `${dir}/cloud-27.webp`, name: "Project 27", type: "misc", form: "square" },
  { src: `${dir}/cloud-28.webp`, name: "Project 28", type: "misc", form: "portrait" },
];

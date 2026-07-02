import { notFound } from "next/navigation";

/**
 * Dev-only gate for the /lab sandboxes (audit 2026-07-02 H5).
 *
 * The lab scenes (/lab/glass, /lab/clouds) are tuning playgrounds — unlinked,
 * but before this gate they were still ROUTABLE in the production build (and
 * /lab/clouds ships its leva panel with it). This server layout 404s the whole
 * segment outside development: `next build` runs with NODE_ENV=production, so
 * the routes prerender straight to the 404 page, while `next dev` keeps the
 * sandboxes usable. Any future /lab/* route inherits the gate automatically.
 */
export default function LabLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return children;
}

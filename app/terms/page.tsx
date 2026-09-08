import type { Metadata } from "next";
import Terms from "@/components/sections/legal/terms";

const TERMS_DESCRIPTION =
  "The terms that govern ascnd's design subscription and build sprints — how requests, revisions, payment, pausing, cancellation, and ownership of the work all work.";

// `title` is just the leaf — the root layout's title.template wraps it into
// "terms of service - ascnd". Canonical/OG URLs are relative, resolved against
// the layout's metadataBase.
export const metadata: Metadata = {
  title: "terms of service",
  description: TERMS_DESCRIPTION,
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "terms of service - ascnd",
    description: TERMS_DESCRIPTION,
    url: "/terms",
  },
  twitter: {
    title: "terms of service - ascnd",
    description: TERMS_DESCRIPTION,
  },
};

/**
 * /terms — the Terms of Service route. Linked from the footer.
 *
 * The whole page (chrome + prose) is <Terms/> via the shared <LegalPage/>
 * shell, so there's nothing to compose here — see
 * components/sections/legal/legal-page.tsx for the layout and why it owns the
 * chrome. Sky, grain, clouds, cursor and the mode switcher all come from the
 * global fixed layers in layout.tsx, inherited with no wiring like every route.
 */
export default function TermsPage() {
  return <Terms />;
}

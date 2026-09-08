import type { Metadata } from "next";
import Refunds from "@/components/sections/legal/refunds";

const REFUNDS_DESCRIPTION =
  "Exactly how cancelling, pausing, and refunds work at ascnd — including build sprint deposits and how approved refunds are paid.";

// `title` is just the leaf — the root layout's title.template wraps it into
// "refund & cancellation - ascnd". Canonical/OG URLs are relative, resolved
// against the layout's metadataBase.
export const metadata: Metadata = {
  title: "refund & cancellation",
  description: REFUNDS_DESCRIPTION,
  alternates: { canonical: "/refunds" },
  openGraph: {
    title: "refund & cancellation - ascnd",
    description: REFUNDS_DESCRIPTION,
    url: "/refunds",
  },
  twitter: {
    title: "refund & cancellation - ascnd",
    description: REFUNDS_DESCRIPTION,
  },
};

/**
 * /refunds — the Refund & Cancellation Policy route.
 *
 * Deliberately NOT in the footer's legal row: it's reached from the
 * cancellation section of the Terms of Service (terms.tsx §6). It is still in
 * SITE_ROUTES, so it's crawlable and linkable on its own.
 *
 * The whole page (chrome + prose) is <Refunds/> via the shared <LegalPage/>
 * shell — see components/sections/legal/legal-page.tsx.
 */
export default function RefundsPage() {
  return <Refunds />;
}

import type { Metadata } from "next";
import Privacy from "@/components/sections/legal/privacy";

const PRIVACY_DESCRIPTION =
  "What information ascnd collects, why we collect it, who we share it with, how long we keep it, and the rights you have over it.";

// `title` is just the leaf — the root layout's title.template wraps it into
// "privacy policy - ascnd". Canonical/OG URLs are relative, resolved against
// the layout's metadataBase.
export const metadata: Metadata = {
  title: "privacy policy",
  description: PRIVACY_DESCRIPTION,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "privacy policy - ascnd",
    description: PRIVACY_DESCRIPTION,
    url: "/privacy",
  },
  twitter: {
    title: "privacy policy - ascnd",
    description: PRIVACY_DESCRIPTION,
  },
};

/**
 * /privacy — the Privacy Policy route. Linked from the footer.
 *
 * The whole page (chrome + prose) is <Privacy/> via the shared <LegalPage/>
 * shell — see components/sections/legal/legal-page.tsx.
 */
export default function PrivacyPage() {
  return <Privacy />;
}

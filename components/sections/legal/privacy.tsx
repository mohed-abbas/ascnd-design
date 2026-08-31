import { LEGAL_DETAILS, LEGAL_PROCESSORS } from "@/lib/legal";
import {
  LegalContact,
  LegalItem,
  LegalLead,
  LegalList,
  LegalP,
  LegalPage,
  LegalSection,
  LegalTable,
} from "./legal-page";

/**
 * /privacy — the Privacy Policy document.
 *
 * Transcribed from files/ascnd-privacy-policy.md. As with the ToS, the prose is
 * the source document's and the `[BRACKETED]` values are hoisted into
 * lib/legal.ts (all still placeholders — see the warning there). Headings are
 * lowercase to match the site's voice; body copy keeps its own sentence case.
 *
 * Two structural notes:
 *   • §2's legal-basis table is a real <table> (LegalTable), which reflows to
 *     stacked blocks below md rather than scrolling sideways.
 *   • §3's processor list comes from LEGAL_PROCESSORS. The source document
 *     carried an author's note there — "trim this list to the tools you
 *     actually use" — which is NOT part of the policy and must never render.
 *     It now lives as a warning comment on the constant instead.
 *
 * ⚠️ Legal text. Do not reword it as part of an unrelated change.
 */
export default function Privacy() {
  return (
    <LegalPage title="privacy policy" lastUpdated={LEGAL_DETAILS.lastUpdated}>
      {/* Preamble — tighter internal gap than the page's section stack. */}
      <div className="flex flex-col gap-[16px]">
        <LegalP>
          This policy explains what information ascnd collects, why we collect
          it, and what we do with it.
        </LegalP>
        <LegalP>
          ascnd (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is a
          design subscription service operated by {LEGAL_DETAILS.entityName} of{" "}
          {LEGAL_DETAILS.registeredAddress}, {LEGAL_DETAILS.country}. If you have
          any questions about this policy or your data, email us at{" "}
          {LEGAL_DETAILS.privacyEmail}.
        </LegalP>
      </div>

      <LegalSection heading="1. information we collect">
        <LegalP>
          <LegalLead>Information you give us directly</LegalLead>
        </LegalP>
        <LegalList>
          <LegalItem>
            <LegalLead>When you book a call:</LegalLead> your name, email
            address, website URL, what you need help with, and anything you write
            in the notes field. Bookings are handled through Cal.com.
          </LegalItem>
          <LegalItem>
            <LegalLead>When you contact us:</LegalLead> your name, email address,
            and the contents of your message.
          </LegalItem>
          <LegalItem>
            <LegalLead>When you become a client:</LegalLead> billing details,
            company information, and the materials you send us to do the work
            (brand assets, copy, product access, feedback, and anything else you
            share).
          </LegalItem>
        </LegalList>
        <LegalP>
          <LegalLead>Information collected automatically</LegalLead>
        </LegalP>
        <LegalP>
          When you visit ascnd.design we may collect your IP address, browser
          type, device type, referring page, pages visited, and time spent. This
          is standard web analytics and we use it to understand how the site is
          performing.
        </LegalP>
        <LegalP>
          <LegalLead>We do not collect</LegalLead> special categories of personal
          data, and we do not knowingly collect information from anyone under 16.
        </LegalP>
      </LegalSection>

      <LegalSection heading="2. why we use it">
        <LegalTable
          columns={["what we use it for", "legal basis (UK/EU GDPR)"]}
          rows={[
            [
              "Responding to enquiries and running intro calls",
              "Legitimate interest / steps prior to a contract",
            ],
            ["Delivering design work to clients", "Performance of a contract"],
            [
              "Invoicing and keeping financial records",
              "Contract and legal obligation",
            ],
            [
              "Understanding site traffic and improving the site",
              "Legitimate interest",
            ],
            ["Sending service-related emails to clients", "Contract"],
            ["Marketing emails, if you have opted in", "Consent"],
          ]}
        />
        <LegalP>
          We do not sell your personal information, and we do not share it with
          third parties for their own marketing.
        </LegalP>
      </LegalSection>

      <LegalSection heading="3. who we share it with">
        <LegalP>
          We use third-party services to run the business. Each of these may
          process some of your information:
        </LegalP>
        <LegalList>
          {LEGAL_PROCESSORS.map(({ name, purpose }) => (
            <LegalItem key={name}>
              <LegalLead>{name}:</LegalLead> {purpose}
            </LegalItem>
          ))}
        </LegalList>
        <LegalP>
          We may also disclose information where we are legally required to, or
          to establish or defend a legal claim.
        </LegalP>
      </LegalSection>

      <LegalSection heading="4. international transfers">
        <LegalP>
          We are based in {LEGAL_DETAILS.country}. If you are in the UK, EU, or
          elsewhere, your information will be transferred to and processed in{" "}
          {LEGAL_DETAILS.country} and in other countries where our service
          providers operate.
        </LegalP>
        <LegalP>
          {LEGAL_DETAILS.country} is not covered by a UK or EU adequacy decision.
          Where required, we rely on Standard Contractual Clauses or your
          explicit consent for these transfers, and we take reasonable steps to
          ensure your information is handled securely wherever it is processed.
        </LegalP>
      </LegalSection>

      <LegalSection heading="5. how long we keep it">
        <LegalList>
          <LegalItem>
            <LegalLead>Enquiries that don&rsquo;t become clients:</LegalLead> up
            to 24 months, then deleted.
          </LegalItem>
          <LegalItem>
            <LegalLead>Client project files and correspondence:</LegalLead> for
            the duration of the engagement and up to 3 years afterwards, so we
            can support past work.
          </LegalItem>
          <LegalItem>
            <LegalLead>Invoices and financial records:</LegalLead> as long as
            required by law, typically 6 years.
          </LegalItem>
          <LegalItem>
            <LegalLead>Analytics data:</LegalLead> as configured in our analytics
            tool, typically 14 to 26 months.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection heading="6. your rights">
        <LegalP>
          Depending on where you live, you may have the right to:
        </LegalP>
        <LegalList>
          <LegalItem>
            ask for a copy of the personal information we hold about you
          </LegalItem>
          <LegalItem>ask us to correct information that is wrong</LegalItem>
          <LegalItem>ask us to delete your information</LegalItem>
          <LegalItem>object to or restrict how we use it</LegalItem>
          <LegalItem>
            ask us to transfer your information to another provider
          </LegalItem>
          <LegalItem>
            withdraw consent at any time, where we rely on consent
          </LegalItem>
          <LegalItem>complain to your local data protection authority</LegalItem>
        </LegalList>
        <LegalP>
          To exercise any of these, email {LEGAL_DETAILS.privacyEmail}. We will
          respond within 30 days. We may need to verify your identity first.
        </LegalP>
        <LegalP>
          <LegalLead>If you are in California:</LegalLead> you have the right to
          know what personal information we collect, to request deletion, and not
          to be discriminated against for exercising those rights. We do not sell
          personal information as defined by the CCPA.
        </LegalP>
      </LegalSection>

      <LegalSection heading="7. cookies">
        <LegalP>
          We use a small number of cookies and similar technologies:
        </LegalP>
        <LegalList>
          <LegalItem>
            <LegalLead>Essential cookies:</LegalLead> needed for the site to
            function.
          </LegalItem>
          <LegalItem>
            <LegalLead>Analytics cookies:</LegalLead> help us understand how the
            site is used.
          </LegalItem>
        </LegalList>
        <LegalP>
          You can block or delete cookies through your browser settings. Blocking
          essential cookies may stop parts of the site working properly.
        </LegalP>
        <LegalP>
          We do not use advertising or cross-site tracking cookies.
        </LegalP>
      </LegalSection>

      <LegalSection heading="8. security">
        <LegalP>
          We take reasonable technical and organisational measures to protect
          your information, including access controls on our tools and encrypted
          connections. No method of transmission or storage is completely secure,
          so we cannot guarantee absolute security.
        </LegalP>
      </LegalSection>

      <LegalSection heading="9. changes to this policy">
        <LegalP>
          We may update this policy from time to time. The date at the top shows
          when it was last changed. Material changes affecting clients will be
          communicated directly.
        </LegalP>
      </LegalSection>

      <LegalSection heading="10. contact">
        <LegalP>Questions about this policy or your information:</LegalP>
        <LegalContact
          lines={[
            LEGAL_DETAILS.privacyEmail,
            LEGAL_DETAILS.registeredAddress,
            "ascnd.design",
          ]}
        />
      </LegalSection>
    </LegalPage>
  );
}

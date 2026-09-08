import { LEGAL_DETAILS, LEGAL_PROCESSORS } from "@/lib/legal";
import {
  LegalContact,
  LegalItem,
  LegalLead,
  LegalLink,
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
 * lib/legal.ts. As on the ToS, the operator clause is prose rather than a
 * substitution — ascnd is an unregistered sole proprietorship, so there is no
 * entity name or registered address to print. Headings are lowercase to match
 * the site's voice; body copy keeps its own sentence case.
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
          design subscription service operated as a sole proprietorship based in{" "}
          {LEGAL_DETAILS.country}. If you have any questions about this policy or
          your data, email us at {LEGAL_DETAILS.privacyEmail}.
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
          <LegalLead>Server logs.</LegalLead> Like any website, ours records the
          requests our hosting receives — including your IP address, browser and
          device type, and the page you asked for. This is how the site is
          served and kept secure.
        </LegalP>
        <LegalP>
          <LegalLead>Analytics.</LegalLead> We use privacy-friendly analytics to
          see how the site is performing: which pages are read, which site or
          link referred you, and the country and device you visited from. It
          sets no cookies, gives you no persistent identifier, and does not
          follow you across other websites. What we see is aggregate — we
          cannot tell from it who you are, or single you out.
        </LegalP>
        <LegalP>
          <LegalLead>Information inside a client&rsquo;s own systems.</LegalLead>{" "}
          When we work on a client&rsquo;s website, product, or accounts, we may
          come across personal data belonging to their users or customers. That
          data isn&rsquo;t ours and this policy doesn&rsquo;t govern it: the
          client decides what happens to it, we only act on their instructions,
          and their own privacy policy is the one that applies. Section 10 of our{" "}
          <LegalLink href="/terms">Terms of Service</LegalLink> sets out how we
          handle that access.
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
          {LEGAL_PROCESSORS.map(({ purpose, vendors }) => (
            <LegalItem key={purpose}>
              <LegalLead>{purpose}:</LegalLead> {vendors.join(", ")}
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
          The service providers listed above carry standard contractual clauses
          in their own data-processing terms, which is the safeguard that covers
          the data they hold. If you are a business client who needs those
          clauses in place directly with us, tell us and we will sign them. We
          take reasonable steps to ensure your information is handled securely
          wherever it is processed.
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
            <LegalLead>Analytics data:</LegalLead> aggregate figures only, never
            tied to you as an individual, kept by our analytics provider for a
            rolling period.
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
          We set no cookies of our own. There is no cookie banner on this site
          because there is nothing here to consent to. Two things do use your
          browser&rsquo;s own storage:
        </LegalP>
        <LegalList>
          <LegalItem>
            <LegalLead>Your display preference:</LegalLead> if you change the
            site&rsquo;s sky, we save that choice in your browser&rsquo;s local
            storage so the site looks the same when you return. It never leaves
            your device, and clearing your browsing data removes it.
          </LegalItem>
          <LegalItem>
            <LegalLead>The booking calendar:</LegalLead> the calendar on our
            pricing page is embedded from Cal.com. When it loads, Cal.com may
            set its own cookies or storage, under its own privacy policy.
          </LegalItem>
        </LegalList>
        <LegalP>
          Our analytics is cookieless — it stores nothing on your device at all.
          We use no advertising or cross-site tracking cookies.
        </LegalP>
        <LegalP>
          You can block or delete cookies and site data through your browser
          settings. Doing so may reset your display preference, or stop the
          booking calendar working properly.
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
        {/* No postal address — see the note in lib/legal.ts. */}
        <LegalContact lines={[LEGAL_DETAILS.privacyEmail, "ascnd.design"]} />
      </LegalSection>
    </LegalPage>
  );
}

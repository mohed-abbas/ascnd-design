import { LEGAL_DETAILS } from "@/lib/legal";
import {
  LegalContact,
  LegalItem,
  LegalLead,
  LegalLink,
  LegalList,
  LegalP,
  LegalPage,
  LegalSection,
} from "./legal-page";

/**
 * /refunds — the Refund & Cancellation Policy.
 *
 * Transcribed from files/ascnd-refund-cancellation-policy.md. Unlike the other
 * two documents this one has no numbered sections and a deliberately warmer
 * register ("no conversation you have to sit through") — that's the source
 * document's own voice and it is kept.
 *
 * NOT LINKED FROM THE FOOTER, by design: the footer carries only terms of
 * service and privacy policy, and this page is reached from the cancellation
 * section of the ToS. The link back below points at /terms#pausing, which is a
 * real anchor on that page (terms.tsx §5), so the reference resolves instead of
 * merely naming the document.
 *
 * ⚠️ Legal text. Do not reword it as part of an unrelated change.
 */
export default function Refunds() {
  return (
    <LegalPage
      title="refund & cancellation"
      lastUpdated={LEGAL_DETAILS.lastUpdated}
    >
      <LegalP>
        We&rsquo;d rather be straightforward about this than bury it. Here&rsquo;s
        exactly how cancellations, pauses, and refunds work at ascnd.
      </LegalP>

      <LegalSection heading="cancelling">
        <LegalP>
          You can cancel your subscription at any time. There&rsquo;s no notice
          period, no cancellation fee, and no conversation you have to sit
          through.
        </LegalP>
        <LegalList>
          <LegalItem>
            Email {LEGAL_DETAILS.contactEmail}{" "}
            and tell us you&rsquo;d like to cancel.
          </LegalItem>
          <LegalItem>
            Cancellation takes effect at the end of your current billing period.
          </LegalItem>
          <LegalItem>
            You keep working with us until then. Nothing gets switched off early.
          </LegalItem>
          <LegalItem>
            We&rsquo;ll deliver the final files for everything that&rsquo;s been
            completed and paid for.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection heading="pausing instead">
        <LegalP>
          If you don&rsquo;t need us right now but expect to later, pausing is
          usually the better option.
        </LegalP>
        <LegalList>
          <LegalItem>
            Any unused days in your current billing period are held as credit and
            applied when you come back.
          </LegalItem>
          <LegalItem>
            You can stay paused for up to {LEGAL_DETAILS.maxPauseDuration}.
          </LegalItem>
          <LegalItem>
            Any locked or founding rate you have is preserved while paused.
          </LegalItem>
        </LegalList>
        <LegalP>
          Full detail is in section 5 of our{" "}
          <LegalLink href="/terms#pausing">Terms of Service</LegalLink>.
        </LegalP>
      </LegalSection>

      <LegalSection heading="refunds">
        <LegalP>
          <LegalLead>
            Monthly subscription fees are non-refundable once the billing period
            has started.
          </LegalLead>{" "}
          We reserve capacity for your work in advance, and a subscription is
          priced on the basis that the month is committed.
        </LegalP>
        <LegalP>That said, here&rsquo;s where we will refund:</LegalP>
        <LegalList>
          <LegalItem>
            <LegalLead>If we haven&rsquo;t started.</LegalLead> If you pay and we
            haven&rsquo;t begun any work, tell us within 7 days and we&rsquo;ll
            refund the payment in full.
          </LegalItem>
          <LegalItem>
            <LegalLead>If we end the engagement.</LegalLead> If we choose to stop
            working with you, we&rsquo;ll refund the unused portion of your
            current period.
          </LegalItem>
          <LegalItem>
            <LegalLead>If we get it badly wrong.</LegalLead> If we&rsquo;ve
            genuinely failed to deliver what we agreed, talk to us. We&rsquo;d
            rather sort it out than have you feel you wasted money, and
            we&rsquo;ll look at each case honestly.
          </LegalItem>
        </LegalList>
        <LegalP>
          <LegalLead>We don&rsquo;t refund</LegalLead> for unused time in a period
          you&rsquo;ve already started, for periods where work stalled because we
          were waiting on your feedback or assets, or for work that&rsquo;s been
          completed and delivered.
        </LegalP>
      </LegalSection>

      <LegalSection heading="build sprints">
        <LegalP>
          Fixed-scope projects work differently, since we block out time
          specifically for them.
        </LegalP>
        <LegalList>
          <LegalItem>
            The deposit confirms your slot and is non-refundable once we&rsquo;ve
            started work.
          </LegalItem>
          <LegalItem>
            If you cancel before we start, the deposit is refundable minus any
            work already carried out.
          </LegalItem>
          <LegalItem>
            If you cancel mid-project, you&rsquo;re billed for the work completed
            to that point and we deliver it.
          </LegalItem>
        </LegalList>
      </LegalSection>

      <LegalSection heading="how refunds are paid">
        <LegalP>
          Approved refunds are returned by the same method you paid, within{" "}
          {LEGAL_DETAILS.refundBusinessDays} business days of approval. Any
          transfer or currency conversion charges applied by intermediaries are
          outside our control.
        </LegalP>
      </LegalSection>

      <LegalSection heading="questions">
        <LegalP>
          If something about this doesn&rsquo;t seem fair for your situation,
          email us. We&rsquo;d rather talk about it than hide behind a policy
          page.
        </LegalP>
        {/* No postal address here — the source document closes with just the
            email and the domain. */}
        <LegalContact
          lines={[LEGAL_DETAILS.contactEmail, "ascnd.design"]}
        />
      </LegalSection>
    </LegalPage>
  );
}

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
 * /terms — the Terms of Service document.
 *
 * Transcribed from files/ascnd-terms-of-service.md. The prose is the source
 * document's, unchanged; only two things differ, both deliberate:
 *   • The `[BRACKETED]` values are hoisted into lib/legal.ts (see the warning
 *     at the top of that file — they are all still placeholders).
 *   • Headings are lowercase, matching the site's voice everywhere else
 *     ("questions, answered straight", "your first month, plotted"). The body
 *     copy keeps the document's own sentence case.
 *
 * §5 carries `id="pausing"` — the refunds page links into it by name, so it is
 * a real anchor target rather than prose that merely mentions the ToS.
 *
 * ⚠️ Legal text. Do not reword, tighten, or "improve" any of it as part of an
 * unrelated change; the wording is the deliverable.
 */
export default function Terms() {
  return (
    <LegalPage title="terms of service" lastUpdated={LEGAL_DETAILS.lastUpdated}>
      {/* Preamble — sits above §1 with its own tighter internal gap, since the
          page stack is spaced for whole sections. */}
      <div className="flex flex-col gap-[16px]">
        <LegalP>
          These terms govern your use of ascnd.design and the design services we
          provide. By using the site, booking a call, or becoming a client, you
          agree to them.
        </LegalP>
        <LegalP>
          ascnd is operated by {LEGAL_DETAILS.entityName} of{" "}
          {LEGAL_DETAILS.registeredAddress}, {LEGAL_DETAILS.country}{" "}
          (&ldquo;ascnd&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
          &ldquo;You&rdquo; and &ldquo;client&rdquo; mean the person or company
          using our services.
        </LegalP>
      </div>

      <LegalSection heading="1. what we do">
        <LegalP>
          ascnd provides design services on a subscription basis, and as
          fixed-scope projects.
        </LegalP>
        <LegalP>
          <LegalLead>Subscription.</LegalLead> You pay a recurring monthly fee
          and submit design requests. We work through them one at a time, in the
          order you prioritise them.
        </LegalP>
        <LegalP>
          <LegalLead>Build sprints.</LegalLead> A fixed piece of work, agreed in
          advance with its own scope, price, and timeline.
        </LegalP>
        <LegalP>
          The specific services, price, and any terms particular to your
          engagement are set out in the agreement or proposal we send you. Where
          those conflict with these terms, your agreement takes precedence.
        </LegalP>
      </LegalSection>

      <LegalSection heading="2. how the subscription works">
        <LegalP>
          <LegalLead>Requests.</LegalLead> You can submit as many requests as you
          like. We work on one active request at a time and move to the next when
          it&rsquo;s approved or parked. Adding more requests doesn&rsquo;t mean
          more work happens simultaneously.
        </LegalP>
        <LegalP>
          <LegalLead>Turnaround.</LegalLead> Most requests are completed within a
          few business days, depending on scope. Larger pieces of work (full
          websites, complete brand identities, multi-screen product design) are
          broken into stages and take longer. Turnaround times are
          estimates based on typical work, not guarantees, and they depend on you
          responding to questions and feedback.
        </LegalP>
        <LegalP>
          <LegalLead>Revisions.</LegalLead> Revisions are included. We&rsquo;ll
          keep refining a request until you&rsquo;re happy with it, within the
          scope of the original request. A revision that fundamentally changes
          the brief becomes a new request.
        </LegalP>
        <LegalP>
          <LegalLead>Fair use.</LegalLead> The subscription is intended for one
          company&rsquo;s design work, used at a reasonable pace. It isn&rsquo;t
          intended for resale, for use by multiple unrelated businesses, or for
          volumes that would require us to hire additional people. If your usage
          goes beyond what a subscription can reasonably support, we&rsquo;ll
          talk to you about it before taking any action.
        </LegalP>
        <LegalP>
          <LegalLead>What isn&rsquo;t included.</LegalLead> Unless separately
          agreed: printing and production, paid media buying, copywriting for
          long-form content, photography and videography, ongoing website
          maintenance and hosting, third-party licences and subscriptions, and
          work outside design and front-end.
        </LegalP>
      </LegalSection>

      <LegalSection heading="3. your responsibilities">
        <LegalP>
          To do good work we need things from you. You agree to:
        </LegalP>
        <LegalList>
          <LegalItem>
            provide briefs, assets, brand materials, and access we reasonably
            need
          </LegalItem>
          <LegalItem>
            give feedback within a reasonable time; extended silence pauses the
            clock, not the billing
          </LegalItem>
          <LegalItem>
            make sure you have the rights to any content you send us, including
            images, fonts, copy, and trademarks
          </LegalItem>
          <LegalItem>
            give us a single point of contact, or tell us who has final approval
          </LegalItem>
        </LegalList>
        <LegalP>
          If work stalls because we&rsquo;re waiting on you, that time still
          counts as part of your billing period.
        </LegalP>
      </LegalSection>

      <LegalSection heading="4. payment">
        <LegalP>
          <LegalLead>Subscription fees</LegalLead> are billed monthly in advance.
          Your billing period starts on the day your first payment is received
          and renews on the same date each month.
        </LegalP>
        <LegalP>
          <LegalLead>Invoicing.</LegalLead> We currently invoice directly.
          Payment methods, currency, and payment details are set out on your
          invoice. Fees are exclusive of any taxes, duties, or transfer charges,
          which are your responsibility.
        </LegalP>
        <LegalP>
          <LegalLead>Due date.</LegalLead> Invoices are payable within{" "}
          {LEGAL_DETAILS.invoiceDueDays} days of issue.
        </LegalP>
        <LegalP>
          <LegalLead>Late payment.</LegalLead> If an invoice is unpaid after{" "}
          {LEGAL_DETAILS.latePaymentGraceDays}{" "}
          days past its due date, we may pause work until it&rsquo;s settled. Paused time from non-payment does
          not extend your billing period.
        </LegalP>
        <LegalP>
          <LegalLead>Price changes.</LegalLead> We may change our prices. Existing
          clients will be given at least 30 days&rsquo; notice, and any founding
          or locked rate we&rsquo;ve agreed with you in writing will be honoured
          for as long as your subscription stays active without interruption.
        </LegalP>
      </LegalSection>

      {/* Anchor target — the refunds page links here by name. */}
      <LegalSection id="pausing" heading="5. pausing your subscription">
        <LegalP>
          You can pause your subscription instead of cancelling it.
        </LegalP>
        <LegalList>
          <LegalItem>
            Pause requests should be sent to {LEGAL_DETAILS.contactEmail} before
            your next billing date.
          </LegalItem>
          <LegalItem>
            When you pause, any unused days in your current billing period are
            held as credit and applied when you resume.
          </LegalItem>
          <LegalItem>
            Subscriptions can be paused for up to {LEGAL_DETAILS.maxPauseDuration}{" "}
            at a time. After that, the subscription is cancelled and any
            remaining credit is forfeited unless we agree otherwise.
          </LegalItem>
          <LegalItem>
            Any locked or founding rate is preserved through a pause.
          </LegalItem>
          <LegalItem>
            While paused, we don&rsquo;t work on requests and you aren&rsquo;t
            billed.
          </LegalItem>
        </LegalList>
        <LegalP>
          Pausing is designed for the periods when you genuinely don&rsquo;t need
          us. It isn&rsquo;t a way to defer payment for work already in progress.
        </LegalP>
      </LegalSection>

      <LegalSection heading="6. cancellation">
        <LegalP>
          You can cancel at any time, with no notice period and no cancellation
          fee.
        </LegalP>
        <LegalList>
          <LegalItem>
            Cancellation takes effect at the end of your current billing period.
            You keep access until then.
          </LegalItem>
          <LegalItem>
            We don&rsquo;t refund partial months. See our{" "}
            <LegalLink href="/refunds">Refund &amp; Cancellation Policy</LegalLink>{" "}
            for the full detail.
          </LegalItem>
          <LegalItem>
            On cancellation we&rsquo;ll deliver the final files for any completed
            work. Work in progress that hasn&rsquo;t been paid for isn&rsquo;t
            delivered.
          </LegalItem>
          <LegalItem>
            If you return later, the rate available at that time applies, unless
            we&rsquo;ve agreed otherwise in writing.
          </LegalItem>
        </LegalList>
        <LegalP>
          We may also end an engagement, with 30 days&rsquo; notice, if the
          working relationship isn&rsquo;t working. In that case we&rsquo;ll
          refund any unused portion of the current period.
        </LegalP>
      </LegalSection>

      <LegalSection heading="7. intellectual property">
        <LegalP>
          <LegalLead>Your materials</LegalLead> stay yours. Anything you send us
          (brand assets, copy, product access, existing designs) remains your
          property.
        </LegalP>
        <LegalP>
          <LegalLead>Final work.</LegalLead> Once a request is complete and fully
          paid for, the intellectual property in the final delivered work
          transfers to you. You own it and can use it however you want.
        </LegalP>
        <LegalP>
          <LegalLead>Before payment,</LegalLead> all rights in the work remain
          with us. Work delivered but not paid for is not licensed for use.
        </LegalP>
        <LegalP>
          <LegalLead>What we keep.</LegalLead> We retain ownership of our own
          tools, templates, systems, components, and general know-how, plus any
          concepts, drafts, and directions that were explored but not selected.
          Nothing here stops us using the same skills and approaches for other
          clients.
        </LegalP>
        <LegalP>
          <LegalLead>Third-party assets.</LegalLead> Fonts, stock imagery, icons,
          plugins, and similar assets are licensed, not owned. Where these are
          used, the licence is yours to hold and maintain. We&rsquo;ll tell you
          what&rsquo;s needed.
        </LegalP>
      </LegalSection>

      <LegalSection heading="8. showing the work">
        <LegalP>
          We&rsquo;d like to be able to show what we make. Unless you tell us
          otherwise, you agree that we may display work we&rsquo;ve done for you
          in our portfolio, on our website, on social media, and in case studies,
          including your company name and logo.
        </LegalP>
        <LegalP>
          If you&rsquo;d prefer we didn&rsquo;t, or you need us to wait until a
          launch date, just tell us. We&rsquo;ll honour it, and we&rsquo;ll never
          publish anything before a client&rsquo;s own public launch without
          asking first.
        </LegalP>
        <LegalP>
          If you need a formal NDA, we&rsquo;re happy to sign one.
        </LegalP>
      </LegalSection>

      <LegalSection heading="9. confidentiality">
        <LegalP>
          We&rsquo;ll keep your confidential information confidential, and
          won&rsquo;t share it with anyone outside our team without your
          permission, except where we&rsquo;re legally required to. This
          doesn&rsquo;t apply to information that&rsquo;s already public, that
          you make public, or that we already knew.
        </LegalP>
        <LegalP>
          The same obligation applies to you regarding anything non-public we
          share with you about how we work.
        </LegalP>
      </LegalSection>

      <LegalSection heading="10. warranties and liability">
        <LegalP>
          We provide our services with reasonable skill and care. Beyond that,
          our services are provided &ldquo;as is&rdquo; and we make no other
          warranties, express or implied.
        </LegalP>
        <LegalP>
          We don&rsquo;t guarantee any particular business outcome. Design
          affects a lot of things, but conversion rates, funding, sales, and
          traffic depend on many factors outside our control, and we don&rsquo;t
          promise results.
        </LegalP>
        <LegalP>
          To the fullest extent permitted by law, our total liability to you for
          any claim arising from these terms is limited to the amount you paid us
          in the 3 months before the claim arose. We aren&rsquo;t liable for
          indirect or consequential losses, including lost profits, lost revenue,
          lost data, or business interruption.
        </LegalP>
        <LegalP>
          Nothing in these terms limits liability for fraud, death or personal
          injury caused by negligence, or anything else that can&rsquo;t be
          limited by law.
        </LegalP>
      </LegalSection>

      <LegalSection heading="11. indemnity">
        <LegalP>
          You agree to indemnify us against any claim arising from materials you
          provide to us, including claims that those materials infringe someone
          else&rsquo;s rights.
        </LegalP>
      </LegalSection>

      <LegalSection heading="12. suspension and termination">
        <LegalP>
          We may suspend or end services immediately if you don&rsquo;t pay, if
          you use our services unlawfully, or if you&rsquo;re abusive towards our
          team. We&rsquo;ll always try to talk to you first where it&rsquo;s
          reasonable to do so.
        </LegalP>
      </LegalSection>

      <LegalSection heading="13. things outside our control">
        <LegalP>
          We&rsquo;re not liable for delays or failures caused by events outside
          our reasonable control, including internet or power outages, illness,
          natural events, or government action. If something like that happens,
          we&rsquo;ll tell you and agree a revised timeline.
        </LegalP>
      </LegalSection>

      <LegalSection heading="14. general">
        <LegalP>
          <LegalLead>Changes.</LegalLead> We may update these terms. Material
          changes will be notified to active clients at least 30 days in advance,
          and the date at the top will change.
        </LegalP>
        <LegalP>
          <LegalLead>No partnership.</LegalLead> These terms don&rsquo;t create a
          partnership, employment, or agency relationship. We operate as an
          independent contractor.
        </LegalP>
        <LegalP>
          <LegalLead>Assignment.</LegalLead> You can&rsquo;t transfer your
          agreement with us to someone else without our written consent.
        </LegalP>
        <LegalP>
          <LegalLead>Severability.</LegalLead> If any part of these terms is found
          unenforceable, the rest stays in force.
        </LegalP>
        <LegalP>
          <LegalLead>Governing law.</LegalLead> These terms are governed by the
          laws of {LEGAL_DETAILS.governingLaw}, and the courts of{" "}
          {LEGAL_DETAILS.jurisdictionCity} have exclusive jurisdiction.
        </LegalP>
      </LegalSection>

      <LegalSection heading="15. contact">
        <LegalContact
          lines={[
            LEGAL_DETAILS.contactEmail,
            LEGAL_DETAILS.registeredAddress,
            "ascnd.design",
          ]}
        />
      </LegalSection>
    </LegalPage>
  );
}

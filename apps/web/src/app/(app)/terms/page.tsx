import {
  ContentList,
  ContentPage,
  ContentSection,
  ContentSubsection,
  ContentText,
} from "@peated/web/components/pages/contentPage.stylex";
import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <ContentPage
      metadata="Effective Date: September 15, 2025"
      intro="Welcome to peated.com (“Peated,” “we,” “our,” or “us”). By accessing or using our website, mobile application, or related services (collectively, the “Services”), you agree to be bound by these Terms of Service (“Terms”). If you do not agree, do not use our Services."
      title="Terms of Service"
    >
      <ContentSection title="1. Eligibility">
        <ContentText>
          You must be of legal drinking age in your country, state, or
          jurisdiction of residence to use the Services. By using the Services,
          you represent and warrant that you meet this requirement. If you are
          not of legal drinking age where you live, you may not access or use
          the Services.
        </ContentText>
      </ContentSection>
      <ContentSection title="2. Purpose of the Services">
        <ContentText>
          Peated provides tools and community features for whisky enthusiasts,
          including the ability to:
        </ContentText>
        <ContentList>
          <li>Track information about your whisky collection;</li>
          <li>Post tasting notes and experiences; and</li>
          <li>Discover information about whiskies shared by others.</li>
        </ContentList>
        <ContentText>Peated does not sell or distribute alcohol.</ContentText>
      </ContentSection>
      <ContentSection title="3. User Content">
        <ContentText>
          You are responsible for all content you submit, post, or share through
          the Services (“User Content”). You retain ownership of your User
          Content, but grant Peated a worldwide, non-exclusive, royalty-free
          license to use, display, reproduce, and distribute it in connection
          with operating the Services. You agree not to post User Content that
          is unlawful, misleading, infringing, or otherwise objectionable.
        </ContentText>
      </ContentSection>
      <ContentSection title="4. Acceptable Use">
        <ContentText>
          You agree to use the Services only for lawful purposes, and you will
          not:
        </ContentText>
        <ContentList>
          <li>Use the Services if you are under legal drinking age;</li>
          <li>Upload viruses, malware, or harmful code;</li>
          <li>
            Interfere with the normal functioning or security of the Services;
            or
          </li>
          <li>Attempt to access accounts or data without authorization.</li>
        </ContentList>
        <ContentSubsection title="Automated Access">
          <ContentText>
            Automated access (including bots, scrapers, and third‑party apps) is
            allowed. You must respect reasonable rate limits, identify your
            client when possible, and avoid activities that degrade or abuse the
            Service.
          </ContentText>
        </ContentSubsection>
      </ContentSection>
      <ContentSection title="5. Intellectual Property">
        <ContentText>
          All content, trademarks, and materials provided through the Services
          (other than User Content) are owned by or licensed to Peated and are
          protected by copyright, trademark, and other laws.
        </ContentText>
        <ContentSubsection title="Third‑Party Trademarks and References">
          <ContentText>
            The Services may reference whiskies, brands, and related trademarks
            that are owned by third parties. All such trademarks, names, and
            logos are the property of their respective owners. Peated does not
            claim ownership or affiliation with any third‑party brands, and
            references are provided for informational purposes only.
          </ContentText>
        </ContentSubsection>
      </ContentSection>
      <ContentSection title="6. Third-Party Links">
        <ContentText>
          The Services may include links to third-party sites. Peated is not
          responsible for the content, policies, or practices of third parties.
        </ContentText>
      </ContentSection>
      <ContentSection title="7. Disclaimers">
        <ContentText>
          The Services are provided “as is” and “as available.” Peated makes no
          warranties, express or implied, about the accuracy, reliability, or
          availability of the Services. Peated does not endorse or guarantee any
          User Content.
        </ContentText>
      </ContentSection>
      <ContentSection title="8. Limitation of Liability">
        <ContentText>
          To the maximum extent permitted by law, Peated and its affiliates will
          not be liable for any indirect, incidental, or consequential damages
          arising from your use of the Services.
        </ContentText>
      </ContentSection>
      <ContentSection title="9. Indemnification">
        <ContentText>
          You agree to indemnify and hold harmless Peated, its affiliates, and
          their respective officers, directors, employees, and agents from any
          claims, damages, or expenses resulting from your use of the Services
          or violation of these Terms.
        </ContentText>
      </ContentSection>
      <ContentSection title="10. Termination">
        <ContentText>
          We may suspend or terminate your access to the Services at any time,
          with or without cause or notice.
        </ContentText>
      </ContentSection>
      <ContentSection title="11. Changes to the Terms">
        <ContentText>
          We may update these Terms from time to time. Changes will be effective
          when posted. Continued use of the Services after changes are posted
          constitutes acceptance of the updated Terms.
        </ContentText>
      </ContentSection>
      <ContentSection title="12. Governing Law">
        <ContentText>
          These Terms will be governed by and construed under the laws of
          [Jurisdiction], without regard to its conflict of law principles.
        </ContentText>
      </ContentSection>
    </ContentPage>
  );
}

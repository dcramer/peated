import {
  ContentLink,
  ContentList,
  ContentPage,
  ContentSection,
  ContentText,
} from "@peated/web/components/pages/contentPage.stylex";
import config from "@peated/web/config";
import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <ContentPage
      metadata="Effective Date: September 21, 2026"
      intro="This policy explains what peated.com (“Peated,” “we,” “our,” or “us”) collects when you use our website, mobile application, or related services (collectively, the “Services”), why we collect it, and how you can control it."
      title="Privacy Policy"
    >
      <ContentSection title="1. What We Collect">
        <ContentText>
          We collect only what the Services need to work:
        </ContentText>
        <ContentList>
          <li>
            <strong>Account details.</strong> Your email address, username,
            password (stored hashed), and optional profile photo.
          </li>
          <li>
            <strong>Sign-in identity.</strong> If you sign in with Google or
            Apple, we receive your account identifier, email address, and name
            from that provider. We never see your password for those accounts.
          </li>
          <li>
            <strong>Content you post.</strong> Tastings, ratings, notes,
            reviews, comments, collections, and photos you attach to tastings.
          </li>
          <li>
            <strong>Location.</strong> The mobile app may ask for your precise
            location to suggest nearby places when you log a tasting. We do not
            store your coordinates.
          </li>
          <li>
            <strong>Diagnostics.</strong> Crash reports and performance data,
            which may include your account identifier and IP address, so we can
            find and fix problems.
          </li>
        </ContentList>
      </ContentSection>
      <ContentSection title="2. How We Use It">
        <ContentText>We use this information to:</ContentText>
        <ContentList>
          <li>Run your account and let you sign in;</li>
          <li>Show your tastings and contributions to other members;</li>
          <li>
            Send account emails such as sign-in links and password resets;
          </li>
          <li>Keep the Services secure and fix bugs; and</li>
          <li>Improve the public whisky record.</li>
        </ContentList>
        <ContentText>
          We do not sell your personal information or use it for advertising.
        </ContentText>
      </ContentSection>
      <ContentSection title="3. What Is Public">
        <ContentText>
          Peated is a public record. Your username, profile photo, tastings,
          reviews, and photos are visible to everyone, including through the
          public API, unless you set your account to private. Your email address
          is never public.
        </ContentText>
      </ContentSection>
      <ContentSection title="4. Who We Share It With">
        <ContentText>
          We share data only with services that help us run Peated: hosting and
          database providers, email delivery, image storage, and Sentry for
          crash and performance reporting. These providers may only use your
          data to provide their service to us. We may also disclose information
          when the law requires it.
        </ContentText>
      </ContentSection>
      <ContentSection title="5. Retention">
        <ContentText>
          We keep your account and content for as long as your account exists.
          Diagnostic data is deleted automatically after a short period. Public
          contributions to the whisky record, such as corrections to bottle
          details, may remain after your account is deleted, without your name
          attached.
        </ContentText>
      </ContentSection>
      <ContentSection title="6. Deleting Your Account">
        <ContentText>
          You can ask us to delete your account at any time. We will remove your
          profile, email address, tastings, reviews, and photos. To request
          deletion, contact us on{" "}
          <ContentLink href={config.DISCORD_LINK}>Discord</ContentLink> or open
          an issue on{" "}
          <ContentLink href={config.GITHUB_REPO}>GitHub</ContentLink>.
        </ContentText>
      </ContentSection>
      <ContentSection title="7. Children">
        <ContentText>
          The Services are for people of legal drinking age. We do not knowingly
          collect information from anyone under that age.
        </ContentText>
      </ContentSection>
      <ContentSection title="8. Changes to This Policy">
        <ContentText>
          We may update this policy from time to time. Changes will be effective
          when posted.
        </ContentText>
      </ContentSection>
    </ContentPage>
  );
}

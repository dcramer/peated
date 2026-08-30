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

export const metadata: Metadata = {
  title: "PeatedBot",
  description: "How PeatedBot accesses public whisky information.",
};

export default function BotPage() {
  return (
    <ContentPage
      eyebrow="Automated access"
      intro="PeatedBot collects public whisky catalog, availability, and review metadata."
      title="PeatedBot"
    >
      <ContentSection title="How it behaves">
        <ContentList>
          <li>It identifies requests as PeatedBot and links to this page.</li>
          <li>It honors robots.txt and source-specific access approval.</li>
          <li>It limits concurrent requests and obeys 429 backoff.</li>
          <li>It uses bounded runs, timeouts, retries, and response sizes.</li>
          <li>It does not bypass authentication or access controls.</li>
        </ContentList>
        <ContentText>
          Peated stores normalized facts and links, not fetched page bodies.
          External reviews keep their attribution and link back to the original
          publisher.
        </ContentText>
      </ContentSection>
      <ContentSection title="Contact">
        <ContentText>
          If our traffic causes a problem, contact us through the{" "}
          <ContentLink href={`${config.GITHUB_REPO}/issues`}>
            Peated issue tracker
          </ContentLink>{" "}
          or the{" "}
          <ContentLink href={config.DISCORD_LINK}>Peated Discord</ContentLink>.
          Include the hostname and request times.
        </ContentText>
      </ContentSection>
    </ContentPage>
  );
}

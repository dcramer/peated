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
  description:
    "What PeatedBot reads, how it limits requests, and how site owners can control access.",
};

export default function BotPage() {
  return (
    <ContentPage
      intro="PeatedBot reads public whisky information so Peated can keep an accurate, freely available catalog."
      title="PeatedBot"
    >
      <ContentSection title="What it reads">
        <ContentText>
          PeatedBot reads public catalog and product pages for bottle names,
          producers, ages, strengths, release years, images, prices, and
          availability. It reads public review pages for titles, writers, dates,
          scores, bottle names, and review text.
        </ContentText>
        <ContentText>
          Peated stores bottle facts, source links, and credit to the original
          website. Full review text may be stored privately so Peated can
          improve how it reads pages without requesting them again. Peated does
          not publish that full text.
        </ContentText>
      </ContentSection>
      <ContentSection title="How it behaves">
        <ContentList>
          <li>
            It identifies requests as PeatedBot/1.0 and links to this page.
          </li>
          <li>It follows robots.txt rules written for PeatedBot.</li>
          <li>
            Each website has its own request limit. PeatedBot spreads those
            requests across the hour.
          </li>
          <li>
            It obeys HTTP 429 responses and waits for the time named in
            Retry-After.
          </li>
          <li>It limits each run, request, retry, and download.</li>
          <li>It does not bypass authentication or access controls.</li>
        </ContentList>
      </ContentSection>
      <ContentSection title="Control access">
        <ContentText>
          Site owners can block all PeatedBot requests by adding a robots.txt
          group for <code>PeatedBot</code> with <code>Disallow: /</code>. A more
          specific rule can allow or block individual paths. After 24 hours,
          Peated checks robots.txt again before making another request.
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
          Include the hostname and request times. We will pause a source while
          investigating an access or rate problem.
        </ContentText>
      </ContentSection>
    </ContentPage>
  );
}

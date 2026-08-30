import { SummaryStrip } from "@peated/web/components/designSystem/components";
import {
  ContentLink,
  ContentPage,
  ContentSection,
  ContentText,
} from "@peated/web/components/designSystem/patterns/contentPage.stylex";
import config from "@peated/web/config";
import { getPublicStats } from "@peated/web/lib/publicStats.server";
import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "About",
};

export default async function AboutPage() {
  const stats = await getPublicStats().catch(() => undefined);

  return (
    <ContentPage
      eyebrow="About Peated"
      intro="A community-maintained record of whisky bottles and the people who make them."
      title="The mission"
    >
      {stats ? (
        <SummaryStrip
          cells={[
            { label: "Bottles", value: stats.bottles.toLocaleString() },
            {
              label: "Distilleries",
              value: stats.distilleries.toLocaleString(),
            },
            { label: "Brands", value: stats.brands.toLocaleString() },
            {
              label: "Tastings",
              value: stats.tastings.toLocaleString(),
            },
          ]}
        />
      ) : null}
      <ContentSection title="Why Peated exists">
        <ContentText>
          Peated is a social record for tasting and collecting whisky. It gives
          the community one place to identify bottles, record what they drank,
          and share useful notes.
        </ContentText>
        <ContentText>
          The catalog is central to that work. It combines public sources and
          community corrections, and the same modern API powers the product.
        </ContentText>
      </ContentSection>
      <ContentSection title="Built in the open">
        <ContentText>
          Peated was started by David Cramer and is{" "}
          <ContentLink href={config.GITHUB_REPO}>
            open source on GitHub
          </ContentLink>
          . Join the{" "}
          <ContentLink href={config.DISCORD_LINK}>Peated Discord</ContentLink>{" "}
          to help improve it.
        </ContentText>
        {config.VERSION ? (
          <ContentText>
            This site runs version{" "}
            <ContentLink
              href={`${config.GITHUB_REPO}/commit/${config.VERSION}`}
            >
              {config.VERSION}
            </ContentLink>
            .
          </ContentText>
        ) : null}
      </ContentSection>
    </ContentPage>
  );
}

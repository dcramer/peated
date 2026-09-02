import {
  FactList,
  RailList,
  RailListItem,
  SummaryStrip,
} from "@peated/web/components";
import {
  PageSection,
  RailSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import config from "@peated/web/config";
import { getPublicStats } from "@peated/web/lib/publicStats.server";
import type { Metadata } from "next";
import {
  AboutLink,
  AboutPage,
  AboutText,
  AboutTextStack,
} from "./aboutPage.stylex";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "About",
  description:
    "Peated is a public record of whisky bottles, the people who make them, and what drinkers thought.",
};

export default async function AboutRoute() {
  const stats = await getPublicStats().catch(() => undefined);

  return (
    <AboutPage
      currentHref="/about"
      description="A public record of whisky bottles, the people who make them, and what the people who drank them thought."
      rail={
        <>
          <RailSection heading="Contribute">
            <RailList ariaLabel="Contribute to Peated">
              <RailListItem
                href="/addBottle?intent=catalog"
                metadata="Anything the catalog is missing"
                title="Record a bottle"
              />
              <RailListItem
                href="/bottles"
                metadata="Open any bottle record"
                title="Suggest a correction"
              />
              <RailListItem
                href={config.DISCORD_LINK}
                title="Peated on Discord"
              />
              <RailListItem
                href={config.GITHUB_REPO}
                title="Source on GitHub"
              />
            </RailList>
          </RailSection>
          <RailSection heading="Reference">
            <RailList ariaLabel="Peated reference pages">
              <RailListItem
                href="/bottlers/4263/codes"
                title="SMWS distillery codes"
              />
              <RailListItem href="/updates" title="Recent changes" />
              <RailListItem href="/terms" title="Terms" />
            </RailList>
          </RailSection>
        </>
      }
      title="About Peated"
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
      <PageSection heading="Why Peated exists">
        <AboutTextStack>
          <AboutText>
            Peated exists to document as much whisky as possible and make that
            record freely accessible to everyone. You can browse the catalog,
            suggest a correction, or read the data through the public API.
          </AboutText>
          <AboutText>
            The catalog combines public sources with corrections from members.
            Members can also record what they drank and add tasting notes and
            reviews.
          </AboutText>
        </AboutTextStack>
      </PageSection>
      <PageSection heading="Built in the open">
        <AboutText>
          Peated was started by David Cramer. The source is on GitHub, and the
          Discord is where members discuss corrections and contributions.
        </AboutText>
        {config.VERSION ? (
          <AboutText>
            This site runs version{" "}
            <AboutLink href={`${config.GITHUB_REPO}/commit/${config.VERSION}`}>
              {config.VERSION}
            </AboutLink>
            .
          </AboutText>
        ) : null}
      </PageSection>
      <PageSection heading="What Peated holds">
        <FactList
          facts={[
            { label: "Started", value: "2023" },
            { label: "Maintained by", value: "Members" },
            { label: "Source code license", value: "Apache 2.0" },
            { label: "API", value: "Public" },
          ]}
          layout="grid"
        />
      </PageSection>
    </AboutPage>
  );
}

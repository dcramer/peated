import * as stylex from "@stylexjs/stylex";

import {
  BottleList,
  type BottleListItem,
  DistributionList,
  FactList,
  type LocationPreviewCardProps,
  RailList,
  RailListItem,
  TextLink,
} from "@peated/web/components";
import { HomeRegionGrid } from "@peated/web/components/pages/homeBrowse.stylex";
import {
  PageColumns,
  PageSection,
  RailSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { colors, fonts } from "../../../styles/tokens.stylex";

import { LocationVisual } from "./locationPageFrame.stylex";

export function LocationOverview({
  categories,
  distilleries,
  distillersHref,
  latestReleases,
  otherRegions = [],
  otherRegionsHref,
  productionRules,
  regions = [],
  releasesHref,
  totalBottles,
  totalDistillers,
  visual,
  visualHeading = "Map",
}: {
  categories: readonly { count: number; label: string }[];
  distilleries: readonly {
    href: string;
    location?: string;
    name: string;
    totalBottles: number;
  }[];
  distillersHref: string;
  latestReleases: readonly BottleListItem[];
  otherRegions?: readonly LocationPreviewCardProps[];
  otherRegionsHref?: string;
  productionRules?: string | null;
  regions?: readonly LocationPreviewCardProps[];
  releasesHref: string;
  totalBottles: number;
  totalDistillers: number;
  visual: { kind: "country" | "state"; slug: string };
  visualHeading?: string;
}) {
  return (
    <PageColumns
      rail={
        <>
          <RailSection heading={visualHeading}>
            <LocationVisual visual={visual} />
          </RailSection>
          {productionRules ? (
            <RailSection heading="Production rules">
              <p {...stylex.props(styles.copy)}>{productionRules}</p>
            </RailSection>
          ) : null}
          {categories.length ? (
            <RailSection heading="Bottles by category">
              <DistributionList items={categories} />
            </RailSection>
          ) : null}
          {otherRegions.length ? (
            <RailSection heading="Other regions">
              {otherRegionsHref ? (
                <TextLink href={otherRegionsHref}>View all regions</TextLink>
              ) : null}
              <RailList ariaLabel="Other regions">
                {otherRegions.map((region) => (
                  <RailListItem
                    href={region.href}
                    key={region.href}
                    metadata={`${region.totalBottles.toLocaleString("en-US")} ${
                      region.totalBottles === 1 ? "bottle" : "bottles"
                    }`}
                    title={region.name}
                  />
                ))}
              </RailList>
            </RailSection>
          ) : null}
        </>
      }
      railBehavior="stack"
    >
      <FactList
        facts={[
          { label: "Bottles", value: totalBottles.toLocaleString("en-US") },
          {
            label: "Distilleries",
            value: totalDistillers.toLocaleString("en-US"),
          },
        ]}
        layout="grid"
      />
      {regions.length ? (
        <PageSection heading="Regions">
          <HomeRegionGrid regions={regions} />
        </PageSection>
      ) : null}
      {distilleries.length ? (
        <PageSection
          heading="Distilleries"
          intro={
            <TextLink href={distillersHref}>
              {totalDistillers === 1
                ? "View 1 distillery"
                : `View all ${totalDistillers.toLocaleString("en-US")} distilleries`}
            </TextLink>
          }
        >
          <RailList ariaLabel="Distilleries">
            {distilleries.map((distillery) => (
              <RailListItem
                href={distillery.href}
                key={distillery.href}
                metadata={[
                  distillery.location,
                  `${distillery.totalBottles.toLocaleString("en-US")} ${
                    distillery.totalBottles === 1 ? "bottle" : "bottles"
                  }`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                title={distillery.name}
              />
            ))}
          </RailList>
        </PageSection>
      ) : null}
      {latestReleases.length ? (
        <PageSection
          heading="Latest releases"
          intro={<TextLink href={releasesHref}>View all releases</TextLink>}
        >
          <BottleList ariaLabel="Latest releases" items={latestReleases} />
        </PageSection>
      ) : null}
    </PageColumns>
  );
}

const styles = stylex.create({
  copy: {
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.55,
  },
});

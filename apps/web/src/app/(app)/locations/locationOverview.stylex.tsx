import type { LocationMap } from "@peated/web/lib/locationMap";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  BottleList,
  type BottleListItem,
  DistributionList,
  DistributionListLoading,
  EntityIdentityRow,
  type EntityListItem,
  FactList,
  ItemListItem,
  LoadingList,
  LoadingPlaceholder,
  LocationIdentityRow,
  type LocationPreviewItem,
  RailList,
  RegionPreviewGrid,
  RegionPreviewGridLoading,
  TextLink,
} from "@peated/web/components";
import {
  PageColumns,
  PageSection,
  RailSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { colors, space } from "../../../styles/tokens.stylex";

import { foundationStyles } from "../../../styles/foundations.stylex";
import { LocationVisual } from "./locationPageFrame.stylex";

export function LocationOverviewFrame({
  children,
  rail,
  totalBottles,
  totalDistillers,
}: {
  children: ReactNode;
  rail: ReactNode;
  totalBottles: number;
  totalDistillers: number;
}) {
  return (
    <PageColumns rail={<div>{rail}</div>} railBehavior="stack">
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
      {children}
    </PageColumns>
  );
}

export function LocationMapSection({ visual }: { visual: LocationMap | null }) {
  return visual ? (
    <PageSection heading="Map">
      <LocationVisual visual={visual} />
    </PageSection>
  ) : null;
}

export function LocationProductionRules({
  content,
}: {
  content?: string | null;
}) {
  return content ? (
    <PageSection heading="Production rules">
      <p {...stylex.props(foundationStyles.body, styles.copy)}>{content}</p>
    </PageSection>
  ) : null;
}

export function LocationCategoriesSection({
  categories,
}: {
  categories: readonly { count: number; label: string }[];
}) {
  return categories.length ? (
    <PageSection heading="Bottles by category">
      <DistributionList items={categories} />
    </PageSection>
  ) : null;
}

export function LocationOtherRegionsSection({
  href,
  regions,
}: {
  href?: string;
  regions: readonly LocationPreviewItem[];
}) {
  return regions.length ? (
    <PageSection
      heading="Other regions"
      intro={href ? <TextLink href={href}>View all regions</TextLink> : null}
    >
      <RailList ariaLabel="Other regions">
        {regions.map((region) => (
          <ItemListItem key={region.href}>
            <LocationIdentityRow
              href={region.href}
              name={region.name}
              variant="sidebar"
            />
          </ItemListItem>
        ))}
      </RailList>
    </PageSection>
  ) : null;
}

export function LocationRegionsSection({
  regions,
}: {
  regions: readonly LocationPreviewItem[];
}) {
  return regions.length ? (
    <PageSection heading="Regions">
      <RegionPreviewGrid regions={regions} />
    </PageSection>
  ) : null;
}

export function LocationDistilleriesSection({
  distilleries,
  href,
  total,
}: {
  distilleries: readonly EntityListItem[];
  href: string;
  total: number;
}) {
  return distilleries.length ? (
    <PageSection
      heading="Distilleries"
      intro={
        <TextLink href={href}>
          {total === 1
            ? "View 1 distillery"
            : `View all ${total.toLocaleString("en-US")} distilleries`}
        </TextLink>
      }
    >
      <RailList ariaLabel="Distilleries">
        {distilleries.map((distillery) => (
          <ItemListItem key={distillery.href}>
            <EntityIdentityRow {...distillery} />
          </ItemListItem>
        ))}
      </RailList>
    </PageSection>
  ) : null;
}

export function LocationLatestReleasesSection({
  href,
  releases,
}: {
  href: string;
  releases: readonly BottleListItem[];
}) {
  return releases.length ? (
    <PageSection
      heading="Latest releases"
      intro={<TextLink href={href}>View all releases</TextLink>}
    >
      <BottleList ariaLabel="Latest releases" items={releases} />
    </PageSection>
  ) : null;
}

export function LocationCategoriesLoading() {
  return (
    <PageSection heading="Bottles by category">
      <DistributionListLoading />
    </PageSection>
  );
}

export function LocationRegionsLoading() {
  return (
    <PageSection heading="Regions">
      <RegionPreviewGridLoading />
    </PageSection>
  );
}

export function LocationDistilleriesLoading() {
  return (
    <PageSection heading="Distilleries">
      <LoadingList label="Loading distilleries" rows={5} variant="text" />
    </PageSection>
  );
}

export function LocationReleasesLoading() {
  return (
    <PageSection heading="Latest releases">
      <LoadingList label="Loading latest releases" rows={5} />
    </PageSection>
  );
}

export function LocationOtherRegionsLoading() {
  return (
    <PageSection heading="Other regions">
      <LoadingList label="Loading other regions" rows={4} variant="text" />
    </PageSection>
  );
}

export function LocationOverviewLoading({
  kind,
}: {
  kind: "country" | "region";
}) {
  return (
    <div aria-busy="true" aria-label={`Loading ${kind} details`} role="status">
      <PageColumns
        rail={
          <div>
            <PageSection heading="Map">
              <div aria-hidden="true" {...stylex.props(styles.loadingVisual)} />
            </PageSection>
            {kind === "country" ? (
              <PageSection heading="Production rules">
                <LoadingPlaceholder preset="text" />
              </PageSection>
            ) : (
              <LocationFlavorProfileLoading />
            )}
            <LocationCategoriesLoading />
            {kind === "region" ? <LocationOtherRegionsLoading /> : null}
          </div>
        }
        railBehavior="stack"
      >
        <FactList
          facts={[
            { label: "Bottles", value: <LoadingPlaceholder preset="text" /> },
            {
              label: "Distilleries",
              value: <LoadingPlaceholder delay={1} preset="text" />,
            },
          ]}
          layout="grid"
        />
        {kind === "country" ? <LocationRegionsLoading /> : null}
        <LocationDistilleriesLoading />
        <LocationReleasesLoading />
      </PageColumns>
    </div>
  );
}

function LocationFlavorProfileLoading() {
  return (
    <RailSection heading="Flavor profile">
      <div aria-busy="true" aria-label="Loading flavor profile" role="status">
        <div aria-hidden="true" {...stylex.props(styles.loadingWheel)} />
        <div aria-hidden="true" {...stylex.props(styles.loadingFooter)}>
          <LoadingPlaceholder preset="metadata" />
        </div>
      </div>
    </RailSection>
  );
}

const styles = stylex.create({
  copy: {
    margin: 0,
    color: colors.inkMuted,
  },
  loadingVisual: {
    height: "220px",
    borderRadius: "3px",
    backgroundColor: colors.inset,
  },
  loadingWheel: {
    width: "100%",
    maxWidth: "336px",
    aspectRatio: "336 / 292",
    marginRight: "auto",
    marginLeft: "auto",
    borderRadius: "3px",
    backgroundColor: colors.inset,
  },
  loadingFooter: {
    width: "152px",
    marginTop: space.x1,
    marginRight: "auto",
    marginLeft: "auto",
  },
});

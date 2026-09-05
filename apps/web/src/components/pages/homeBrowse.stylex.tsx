import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { SectionHeading } from "../sectionHeading.stylex";
import { TextLink } from "../textLink.stylex";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, space } from "../../styles/tokens.stylex";
import { BottleList, type BottleListItem } from "../bottleList.stylex";
import {
  EntityIdentityRow,
  type EntityListItem,
} from "../entityIdentityRow.stylex";
import { LoadingList } from "../feedback.stylex";
import { ItemList, ItemListItem } from "../itemList.stylex";
import {
  LocationPreviewGrid,
  LocationPreviewGridLoading,
  type LocationPreviewItem,
  RegionPreviewGrid,
  RegionPreviewGridLoading,
} from "../locationPreviewCard.stylex";

function HomeSectionHeading({
  action,
  detail,
  title,
}: {
  action?: ReactNode;
  detail?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.heading)}>
      <div {...stylex.props(styles.headingLine)}>
        <SectionHeading>{title}</SectionHeading>
        {action}
      </div>
      {detail ? (
        <div {...stylex.props(foundationStyles.metadata, styles.detail)}>
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function HomeListSectionLayout({
  action,
  children,
  detail,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  detail?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeSectionHeading action={action} detail={detail} title={title} />
      <div {...stylex.props(styles.rows)}>{children}</div>
    </section>
  );
}

/** Shows bottles with published median scores in API rank order. */
export function HomeHighestRated({
  bottles,
  totalRated,
}: {
  bottles: readonly BottleListItem[];
  totalRated: number;
}) {
  return (
    <HomeListSectionLayout
      action={
        <TextLink href="/bottles?sort=-score&minScore=0" size="sm">
          All {totalRated.toLocaleString("en-US")} rated{" "}
          <span aria-hidden="true">→</span>
        </TextLink>
      }
      title="Bottles to try"
    >
      <BottleList ariaLabel="Bottles to try" items={bottles} />
    </HomeListSectionLayout>
  );
}

/** Shows bottles with known release years in API release order. */
export function HomeLatestReleases({
  bottles,
  seeAllHref,
  title,
}: {
  bottles: readonly BottleListItem[];
  seeAllHref: string;
  title: string;
}) {
  return (
    <HomeListSectionLayout
      action={
        <TextLink href={seeAllHref} size="sm">
          View all <span aria-hidden="true">→</span>
        </TextLink>
      }
      title={title}
    >
      <BottleList ariaLabel={title} items={bottles} />
    </HomeListSectionLayout>
  );
}

export function HomeActivityFeed({ children }: { children: ReactNode }) {
  return (
    <HomeListSectionLayout
      action={
        <TextLink href="/activity" size="sm">
          View all <span aria-hidden="true">→</span>
        </TextLink>
      }
      title="Activity"
    >
      {children}
    </HomeListSectionLayout>
  );
}

function HomeOriginsLayout({
  countries,
  regions,
}: {
  countries: ReactNode;
  regions?: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeSectionHeading
        action={
          <TextLink href="/locations" size="sm">
            Open the map <span aria-hidden="true">→</span>
          </TextLink>
        }
        title="Browse by origin"
      />
      <p {...stylex.props(foundationStyles.body, styles.originIntro)}>
        Mostly Scotch, a good deal of American, and a growing amount of
        everything else.
      </p>
      <div {...stylex.props(styles.countryGrid)}>{countries}</div>
      {regions ? (
        <>
          <div {...stylex.props(styles.regionHeading)}>
            <SectionHeading level={3}>By region</SectionHeading>
          </div>
          {regions}
        </>
      ) : null}
    </section>
  );
}

function HomeDistilleriesLayout({
  children,
  linkLabel,
}: {
  children: ReactNode;
  linkLabel: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <HomeSectionHeading title="Distilleries" />
      <div {...stylex.props(styles.distilleries)}>{children}</div>
      <div {...stylex.props(styles.distilleryLink)}>
        <TextLink href="/distillers">
          {linkLabel} <span aria-hidden="true">→</span>
        </TextLink>
      </div>
    </section>
  );
}

export function HomeOrigins({
  countries,
  remainingCountries,
  regions,
}: {
  countries: readonly LocationPreviewItem[];
  remainingCountries?: { count: number; totalBottles: number };
  regions: readonly LocationPreviewItem[];
}) {
  const countryLocations: LocationPreviewItem[] = [
    ...countries,
    ...(remainingCountries && remainingCountries.count > 0
      ? [
          {
            href: "/locations",
            name: "Everywhere else",
            totalBottles: remainingCountries.totalBottles,
            visual: {
              kind: "count" as const,
              value: remainingCountries.count,
            },
          },
        ]
      : []),
  ];

  return (
    <HomeOriginsLayout
      countries={
        <LocationPreviewGrid
          locations={countryLocations}
          showDescriptions={false}
        />
      }
      regions={
        regions.length ? <RegionPreviewGrid regions={regions} /> : undefined
      }
    />
  );
}

export function HomeDistilleries({
  distilleries,
  totalDistilleries,
}: {
  distilleries: readonly EntityListItem[];
  totalDistilleries?: number;
}) {
  return (
    <HomeDistilleriesLayout
      linkLabel={
        totalDistilleries === undefined
          ? "View all distilleries"
          : `View ${totalDistilleries.toLocaleString("en-US")} distilleries`
      }
    >
      <ItemList ariaLabel="Distilleries">
        {distilleries.map((distillery) => (
          <ItemListItem key={distillery.href}>
            <EntityIdentityRow {...distillery} />
          </ItemListItem>
        ))}
      </ItemList>
    </HomeDistilleriesLayout>
  );
}

export function HomeContributionPrompt({
  primaryAction,
  secondaryAction,
}: {
  primaryAction: ReactNode;
  secondaryAction: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.prompt)}>
      <SectionHeading>Missing a bottle?</SectionHeading>
      <p {...stylex.props(foundationStyles.metadata, styles.promptCopy)}>
        Add it. Cask number, vintage, ABV, finish—as much as the label tells
        you.
      </p>
      <div {...stylex.props(styles.promptActions)}>
        {primaryAction}
        {secondaryAction}
      </div>
    </section>
  );
}

/** Keeps the recent releases heading and link visible while its rows load. */
export function HomeLatestReleasesLoading() {
  return (
    <HomeListSectionLayout
      action={
        <TextLink href="/bottles?sort=-release" size="sm">
          View all <span aria-hidden="true">→</span>
        </TextLink>
      }
      title="Recent releases"
    >
      <LoadingList label="Loading recent releases" rows={5} />
    </HomeListSectionLayout>
  );
}

/** Keeps the activity heading and link visible while its rows load. */
export function HomeActivityFeedLoading() {
  return (
    <HomeListSectionLayout
      action={
        <TextLink href="/activity" size="sm">
          View all <span aria-hidden="true">→</span>
        </TextLink>
      }
      title="Activity"
    >
      <LoadingList label="Loading activity" rows={3} />
    </HomeListSectionLayout>
  );
}

/** Keeps the distillery section and link visible while its rows load. */
export function HomeDistilleriesLoading() {
  return (
    <HomeDistilleriesLayout linkLabel="View all distilleries">
      <LoadingList label="Loading distilleries" rows={5} variant="sidebar" />
    </HomeDistilleriesLayout>
  );
}

/** Reserves the normally visible country and Scottish region card grids. */
export function HomeOriginsLoading() {
  return (
    <HomeOriginsLayout
      countries={
        <LocationPreviewGridLoading
          label="Loading countries"
          showDescriptions={false}
        />
      }
      regions={<RegionPreviewGridLoading />}
    />
  );
}

const styles = stylex.create({
  section: {
    minWidth: 0,
  },
  heading: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    flexDirection: "column",
    rowGap: space.x2,
  },
  headingLine: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x3,
  },
  detail: {
    color: colors.inkMuted,
  },
  rows: {
    marginTop: space.x2,
  },
  originIntro: {
    maxWidth: "640px",
    marginTop: space.x2,
    marginBottom: 0,
    color: colors.inkMuted,
  },
  regionHeading: { marginTop: space.x6 },
  countryGrid: {
    marginTop: space.x4,
  },
  distilleries: {
    marginTop: "14px",
  },
  distilleryLink: {
    marginTop: space.x3,
  },
  prompt: {
    paddingTop: "18px",
    paddingBottom: "18px",
    backgroundColor: "transparent",
  },
  promptCopy: {
    margin: 0,
    marginTop: space.x1,
    color: colors.inkMuted,
  },
  promptActions: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: space.x3,
    flexWrap: "wrap",
  },
});

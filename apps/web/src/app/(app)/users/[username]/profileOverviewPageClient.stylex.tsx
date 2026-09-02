"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";

import {
  AppLink,
  FactList,
  LoadingPlaceholder,
  RailList,
  RailListItem,
  SectionHeading,
  TastingRatingDistribution,
  type FactListItem,
  type TastingRatingCounts,
} from "@peated/web/components";
import { MemberActivityList } from "@peated/web/components/pages/memberProfileContent.stylex";
import {
  PageColumns,
  RailSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";
import { colors, space } from "../../../../styles/tokens.stylex";
import { toActivityItem } from "./profileActivity";
import { useProfile } from "./profileContext";
import { ProfilePassport } from "./profilePassport.stylex";

type ActivityList = Outputs["users"]["activity"]["list"];
type BadgeAward = Outputs["users"]["badgeList"]["results"][number];
type TastingStats = Outputs["users"]["tastingStats"];
type ProducerKind = "brand" | "bottler" | "distillery";
type ProducerStat = TastingStats["producers"]["brands"][number];
type ProducerGroup = {
  heading: string;
  items: readonly ProducerStat[];
  kind: ProducerKind;
};

export function ProfileOverviewPageClient({
  initialActivityList,
  initialBadgeAwards,
  initialTastingStats,
}: {
  initialActivityList: ActivityList;
  initialBadgeAwards: readonly BadgeAward[];
  initialTastingStats: TastingStats;
}) {
  const orpc = useORPC();
  const { isCurrentUser, user } = useProfile();
  const statsQuery = useQuery({
    ...orpc.users.tastingStats.queryOptions({ input: { user: user.id } }),
    initialData: initialTastingStats,
  });
  const bands = getBands(statsQuery.data);
  const producerGroups = getProducerGroups(statsQuery.data?.producers);
  const facts: readonly [FactListItem, ...FactListItem[]] = user.createdAt
    ? [
        { label: "Tastings", value: formatCount(user.stats.tastings) },
        { label: "Bottles tasted", value: formatCount(user.stats.bottles) },
        { label: "In library", value: formatCount(user.stats.library.total) },
        {
          label: "Catalog changes",
          value: formatCount(user.stats.contributions),
        },
        { label: "Joined", value: formatJoinDate(user.createdAt) },
      ]
    : [
        { label: "Tastings", value: formatCount(user.stats.tastings) },
        { label: "Bottles tasted", value: formatCount(user.stats.bottles) },
        { label: "In library", value: formatCount(user.stats.library.total) },
        {
          label: "Catalog changes",
          value: formatCount(user.stats.contributions),
        },
      ];
  const activity = initialActivityList.results
    .filter(
      (item) =>
        item.type !== "collection_add" ||
        !item.collection.href?.endsWith("/favorites"),
    )
    .slice(0, 3)
    .map(toActivityItem);

  return (
    <div {...stylex.props(styles.overview)}>
      <PageColumns
        rail={
          <>
            {producerGroups.length ? (
              <ProducerSections groups={producerGroups} />
            ) : null}
            <RailSection heading="Passport">
              <ProfilePassport awards={initialBadgeAwards} />
            </RailSection>
            {statsQuery.isPending || bands ? (
              <RatingSummary
                bands={bands}
                label={isCurrentUser ? "Your ratings" : "Their ratings"}
                loading={statsQuery.isPending}
              />
            ) : null}
          </>
        }
        railBehavior="stack"
      >
        <div {...stylex.props(styles.main)}>
          <FactList facts={facts} layout="grid" />
          <section aria-label="Recent activity">
            <div {...stylex.props(styles.sectionHeader)}>
              <SectionHeading>Recent activity</SectionHeading>
              <AppLink href={`/users/${user.username}/activity`}>
                View all
              </AppLink>
            </div>
            <MemberActivityList
              emptyDescription={
                isCurrentUser
                  ? "Your tastings and library additions will appear here."
                  : `${user.username} has no recent activity.`
              }
              items={activity}
            />
          </section>
        </div>
      </PageColumns>
    </div>
  );
}

function ProducerSections({ groups }: { groups: readonly ProducerGroup[] }) {
  return (
    <>
      {groups.map((group) => (
        <RailSection heading={group.heading} key={group.kind}>
          <RailList ariaLabel={`${group.heading} tasted often`}>
            {group.items.map((producer) => (
              <RailListItem
                end={formatCount(producer.count)}
                href={getEntityUrl({
                  id: producer.id,
                  kind: group.kind,
                  name: producer.name,
                })}
                key={producer.id}
                title={producer.name}
              />
            ))}
          </RailList>
        </RailSection>
      ))}
    </>
  );
}

function RatingSummary({
  bands,
  label,
  loading,
}: {
  bands?: TastingRatingCounts;
  label: string;
  loading: boolean;
}) {
  return (
    <RailSection heading={label}>
      {bands ? (
        <TastingRatingDistribution counts={bands} showCounts />
      ) : (
        <div
          aria-busy="true"
          aria-label="Loading ratings"
          role="status"
          {...stylex.props(styles.ratingLoading)}
        >
          <LoadingPlaceholder preset="heading" />
          <LoadingPlaceholder delay={1} preset="text" />
          <LoadingPlaceholder delay={2} preset="metadata" />
        </div>
      )}
    </RailSection>
  );
}

function getBands(stats?: TastingStats): TastingRatingCounts | undefined {
  if (!stats?.bands.total) return undefined;
  return {
    good: stats.bands.good,
    mediocre: stats.bands.mediocre,
    outstanding: stats.bands.outstanding,
    unicorn: stats.bands.unicorn,
    very_good: stats.bands.very_good,
  };
}

function getProducerGroups(
  producers?: TastingStats["producers"],
): ProducerGroup[] {
  if (!producers) return [];

  const groups: ProducerGroup[] = [];
  if (producers.distillers.length) {
    groups.push({
      heading: "Distillers",
      items: producers.distillers.slice(0, 3),
      kind: "distillery",
    });
  }
  if (producers.bottlers.length) {
    groups.push({
      heading: "Bottlers",
      items: producers.bottlers.slice(0, 3),
      kind: "bottler",
    });
  }
  if (groups.length < 2 && producers.brands.length) {
    groups.push({
      heading: "Brands",
      items: producers.brands.slice(0, 3),
      kind: "brand",
    });
  }
  return groups;
}

function formatJoinDate(createdAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(createdAt));
}

function formatCount(count: number) {
  return count.toLocaleString("en-US");
}

const styles = stylex.create({
  overview: {
    minWidth: 0,
  },
  main: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x8,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.x4,
    paddingBottom: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
  },
  ratingLoading: {
    display: "flex",
    minHeight: "66px",
    flexDirection: "column",
    gap: space.x2,
  },
});

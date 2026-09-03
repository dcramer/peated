"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { getEntityIdentityProps } from "@peated/web/lib/entityIdentity";
import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";

import {
  EmptyState,
  EntityIdentityRow,
  FactList,
  ItemListItem,
  LoadingPlaceholder,
  RailList,
  TastingRatingDistribution,
  type FactListItem,
  type TastingRatingCounts,
} from "@peated/web/components";
import { CommunityFeed } from "@peated/web/components/communityFeed.stylex";
import { RailSection } from "@peated/web/components/pages/pageLayout.stylex";
import { getCommunityFeedItems } from "@peated/web/lib/communityFeed";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";
import { space } from "../../../../styles/tokens.stylex";
import { useProfile } from "./profileContext";
import {
  ProfileActivitySection,
  ProfileOverviewLayout,
} from "./profileOverviewLayout.stylex";
import { ProfilePassport } from "./profilePassport.stylex";
import { profileQueries } from "./profileQueries";

type ActivityList = Outputs["users"]["activity"]["list"];
type BadgeAward = Outputs["users"]["badgeList"]["results"][number];
type TastingStats = Outputs["users"]["tastingStats"];
type ProducerStat = TastingStats["producers"]["brands"][number];
type ProducerGroup = {
  heading: string;
  items: readonly ProducerStat[];
};

export function ProfileOverviewPageClient({
  initialActivityList,
  initialBadgeAwards,
}: {
  initialActivityList: ActivityList;
  initialBadgeAwards: readonly BadgeAward[];
}) {
  const orpc = useORPC();
  const { isCurrentUser, user } = useProfile();
  const statsQuery = useQuery(profileQueries.tastingStats(orpc, user.id));
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
  const activity = getCommunityFeedItems({
    activity: initialActivityList.results,
    criticReviews: [],
  }).slice(0, 3);

  return (
    <ProfileOverviewLayout
      main={
        <>
          <FactList facts={facts} layout="grid" />
          <ProfileActivitySection username={user.username}>
            {activity.length ? (
              <CommunityFeed ariaLabel="Member activity" items={activity} />
            ) : (
              <EmptyState heading="No activity yet">
                {isCurrentUser
                  ? "Your tastings, reviews, and library additions will appear here."
                  : `${user.username} has no recent activity.`}
              </EmptyState>
            )}
          </ProfileActivitySection>
        </>
      }
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
    />
  );
}

function ProducerSections({ groups }: { groups: readonly ProducerGroup[] }) {
  return (
    <>
      {groups.map((group) => (
        <RailSection heading={group.heading} key={group.heading}>
          <RailList ariaLabel={`${group.heading} tasted often`}>
            {group.items.map((producer) => (
              <ItemListItem key={producer.id}>
                <EntityIdentityRow
                  {...getEntityIdentityProps(producer)}
                  variant="sidebar"
                  end={formatCount(producer.count)}
                  href={getEntityUrl(producer)}
                />
              </ItemListItem>
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
    });
  }
  if (producers.bottlers.length) {
    groups.push({
      heading: "Bottlers",
      items: producers.bottlers.slice(0, 3),
    });
  }
  if (groups.length < 2 && producers.brands.length) {
    groups.push({
      heading: "Brands",
      items: producers.brands.slice(0, 3),
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
  ratingLoading: {
    display: "flex",
    minHeight: "66px",
    flexDirection: "column",
    gap: space.x2,
  },
});

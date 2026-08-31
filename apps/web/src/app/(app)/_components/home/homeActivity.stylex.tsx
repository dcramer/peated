"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Fragment, useEffect } from "react";
import { useEventListener } from "usehooks-ts";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import {
  AppLink,
  ButtonLink,
  EmptyState,
  ItemList,
  ItemRow,
  LoadingList,
  MemberAvatar,
  SectionError,
  TastingEntry,
  type TastingEntryMember,
} from "@peated/web/components";
import { getTastingEntryMember } from "@peated/web/components/tastingRecordEntry";
import TimeSince from "@peated/web/components/timeSince";
import { getBottleMetadata } from "@peated/web/lib/bottleMetadata";
import { useORPC } from "@peated/web/lib/orpc/context";
import { memberHomeQueries } from "@peated/web/lib/orpc/homeQueries";
import { colors } from "../../../../styles/tokens.stylex";

type ActivityList = Outputs["activity"]["list"];
type ActivityResult = ActivityList["results"][number];
type TastingSession = Extract<ActivityResult, { type: "tasting_session" }>;
type CollectionActivity = Extract<ActivityResult, { type: "collection_add" }>;

function TastingActivity({ session }: { session: TastingSession }) {
  const [firstTasting, ...otherTastings] = session.tastings;
  if (!firstTasting) return null;

  const members: [TastingEntryMember, ...TastingEntryMember[]] = [
    getTastingEntryMember(firstTasting),
    ...otherTastings.map(getTastingEntryMember),
  ];

  return (
    <TastingEntry
      author={session.createdBy.username}
      authorHref={`/users/${session.createdBy.username}`}
      context={
        members.length > 1
          ? `${members.length.toLocaleString()} tastings`
          : undefined
      }
      date={<TimeSince date={session.lastActivityAt} />}
      leading={
        <MemberAvatar
          pictureUrl={session.createdBy.pictureUrl}
          size="sm"
          username={session.createdBy.username}
        />
      }
      members={members}
    />
  );
}

function formatBottleCount(count: number) {
  return `${count.toLocaleString()} bottle${count === 1 ? "" : "s"}`;
}

function CollectionActivityItem({
  activity,
}: {
  activity: CollectionActivity;
}) {
  const visibleItems = activity.items.slice(0, 3);
  const remaining = activity.totalItems - visibleItems.length;

  return (
    <div {...stylex.props(styles.collection)}>
      <div {...stylex.props(styles.collectionHeader)}>
        <MemberAvatar
          pictureUrl={activity.createdBy.pictureUrl}
          size="sm"
          username={activity.createdBy.username}
        />
        <div {...stylex.props(styles.collectionCopy)}>
          <AppLink
            href={`/users/${activity.createdBy.username}`}
            {...stylex.props(styles.collectionAuthor)}
          >
            {activity.createdBy.username}
          </AppLink>
          <span {...stylex.props(styles.collectionContext)}>
            added {formatBottleCount(activity.totalItems)} to{" "}
            {activity.collection.href ? (
              <AppLink href={activity.collection.href}>
                {activity.collection.name}
              </AppLink>
            ) : (
              activity.collection.name
            )}
            <span aria-hidden="true"> · </span>
            <TimeSince date={activity.createdAt} />
          </span>
        </div>
      </div>
      {visibleItems.length ? (
        <ItemList ariaLabel={`${activity.collection.name} additions`}>
          {visibleItems.map((item) => (
            <ItemRow
              href={`/bottles/${item.bottle.id}`}
              key={item.id}
              metadata={getBottleMetadata(item.bottle)}
              title={formatBottleDisplayName(item.bottle)}
            />
          ))}
          {remaining > 0 ? (
            <ItemRow
              href={activity.collection.href ?? undefined}
              title={`+${remaining.toLocaleString()} more`}
            />
          ) : null}
        </ItemList>
      ) : null}
    </div>
  );
}

function filterFavoriteActivity(results: readonly ActivityResult[]) {
  return results.filter(
    (activity) =>
      activity.type !== "collection_add" ||
      !activity.collection.href?.endsWith("/favorites"),
  );
}

export function HomeActivity({
  filter = "friends",
  initialData,
}: {
  filter?: "friends" | "global" | "local";
  initialData?: ActivityList;
}) {
  const orpc = useORPC();
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isPending,
    refetch,
  } = useInfiniteQuery({
    ...memberHomeQueries.activity(orpc, filter),
    initialPageParam: undefined,
    initialData: initialData
      ? { pages: [initialData], pageParams: [undefined] }
      : undefined,
  });

  const results = filterFavoriteActivity(
    data?.pages.flatMap((page) => page.results) ?? [],
  );

  useEventListener("scroll", () => {
    if (!hasNextPage || isFetchingNextPage) return;
    const root = document.documentElement;
    if (root.scrollTop + root.clientHeight >= root.scrollHeight - 160) {
      void fetchNextPage();
    }
  });

  useEffect(() => {
    if (results.length < 10 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, results.length]);

  if (isPending) {
    return <LoadingList label="Loading recent activity" rows={4} />;
  }

  if (error) {
    return (
      <SectionError
        heading="Activity is unavailable"
        onRetry={() => void refetch()}
      >
        We couldn't load recent tastings and library updates. Try again.
      </SectionError>
    );
  }

  if (!results.length && !hasNextPage) {
    if (filter === "friends") {
      return (
        <EmptyState
          action={
            <ButtonLink href="/search?type=users" size="sm" variant="accent">
              Find people
            </ButtonLink>
          }
          heading="No activity from friends yet"
        >
          Follow people to see their tastings and library updates here.
        </EmptyState>
      );
    }

    return (
      <EmptyState
        action={
          <ButtonLink
            href="/addBottle?intent=tasting"
            size="sm"
            variant="accent"
          >
            Log a tasting
          </ButtonLink>
        }
        heading="No recent activity"
      >
        No recent tastings or Library updates.
      </EmptyState>
    );
  }

  return (
    <div aria-busy={isFetching} {...stylex.props(styles.activityList)}>
      {results.map((activity) => (
        <Fragment key={activity.id}>
          {activity.type === "tasting_session" ? (
            <TastingActivity session={activity} />
          ) : (
            <CollectionActivityItem activity={activity} />
          )}
        </Fragment>
      ))}
      {isFetchingNextPage ? (
        <div {...stylex.props(styles.moreLoading)}>
          <LoadingList label="Loading more activity" rows={1} />
        </div>
      ) : null}
    </div>
  );
}

const styles = stylex.create({
  collection: {
    paddingTop: "22px",
    paddingRight: "24px",
    paddingBottom: "22px",
    paddingLeft: "24px",
    borderRadius: "3px",
    backgroundColor: colors.surface,
  },
  collectionHeader: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  collectionCopy: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
  },
  collectionAuthor: {
    color: colors.ink,
    fontSize: "13px",
    fontWeight: 600,
    textDecoration: "none",
  },
  collectionContext: {
    marginTop: "2px",
    color: colors.inkMuted,
    fontSize: "11px",
    lineHeight: 1.35,
  },
  moreLoading: {
    marginTop: "16px",
  },
  activityList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
});

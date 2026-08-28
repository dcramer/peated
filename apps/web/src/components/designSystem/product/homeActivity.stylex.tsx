"use client";

import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import {
  useInfiniteQuery,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";
import { Fragment, useEffect } from "react";
import { useEventListener } from "usehooks-ts";

import { useORPC } from "../../../lib/orpc/context";
import { colors } from "../../../styles/tokens.stylex";
import TimeSince from "../../timeSince";
import {
  ButtonLink,
  EmptyState,
  LoadingList,
  SectionError,
  TastingEntry,
  type TastingEntryMember,
} from "../components";
import { RecordList, RecordRow } from "../patterns/pagePatternShell.stylex";

type ActivityList = Outputs["activity"]["list"];
type ActivityResult = ActivityList["results"][number];
type TastingSession = Extract<ActivityResult, { type: "tasting_session" }>;
type CollectionActivity = Extract<ActivityResult, { type: "collection_add" }>;

function getBottleMetadata(
  bottle: TastingSession["tastings"][number]["bottle"],
) {
  return [
    formatCategoryName(bottle.category),
    bottle.statedAge === null ? null : `${bottle.statedAge} years`,
    bottle.abv === null ? null : `${bottle.abv.toFixed(1)}% ABV`,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function getTastingMember(
  tasting: TastingSession["tastings"][number],
): TastingEntryMember {
  return {
    description: tasting.notes,
    href: `/bottles/${tasting.bottle.id}`,
    metadata: getBottleMetadata(tasting.bottle),
    name: tasting.bottle.fullName,
    notes: tasting.tags,
    ratingBand: tasting.ratingBand ?? undefined,
  };
}

function UserVisual({
  pictureUrl,
  username,
}: {
  pictureUrl: string | null;
  username: string;
}) {
  return pictureUrl ? (
    <img alt="" src={pictureUrl} {...stylex.props(styles.avatar)} />
  ) : (
    <span aria-hidden="true" {...stylex.props(styles.avatarFallback)}>
      {username.slice(0, 2).toLocaleUpperCase()}
    </span>
  );
}

function TastingActivity({ session }: { session: TastingSession }) {
  const [firstTasting, ...otherTastings] = session.tastings;
  if (!firstTasting) return null;

  const members: [TastingEntryMember, ...TastingEntryMember[]] = [
    getTastingMember(firstTasting),
    ...otherTastings.map(getTastingMember),
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
        <UserVisual
          pictureUrl={session.createdBy.pictureUrl}
          username={session.createdBy.username}
        />
      }
      members={members}
      surface
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
        <UserVisual
          pictureUrl={activity.createdBy.pictureUrl}
          username={activity.createdBy.username}
        />
        <div {...stylex.props(styles.collectionCopy)}>
          <a
            href={`/users/${activity.createdBy.username}`}
            {...stylex.props(styles.collectionAuthor)}
          >
            {activity.createdBy.username}
          </a>
          <span {...stylex.props(styles.collectionContext)}>
            added {formatBottleCount(activity.totalItems)} to{" "}
            {activity.collection.href ? (
              <a href={activity.collection.href}>{activity.collection.name}</a>
            ) : (
              activity.collection.name
            )}
            <span aria-hidden="true"> · </span>
            <TimeSince date={activity.createdAt} />
          </span>
        </div>
      </div>
      {visibleItems.length ? (
        <RecordList ariaLabel={`${activity.collection.name} additions`}>
          {visibleItems.map((item) => (
            <RecordRow
              href={`/bottles/${item.bottle.id}`}
              key={item.id}
              metadata={getBottleMetadata(item.bottle)}
              title={item.bottle.fullName}
            />
          ))}
          {remaining > 0 ? (
            <RecordRow
              href={activity.collection.href ?? undefined}
              title={`+${remaining.toLocaleString()} more`}
            />
          ) : null}
        </RecordList>
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
  // The activity cursor belongs to each fetched page, so the first page has no
  // cursor. ORPC does not expose an infinite query helper for this route.
  /* oxlint-disable @tanstack/query/prefer-query-options */
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isPending,
    refetch,
  } = useInfiniteQuery<
    ActivityList,
    Error,
    InfiniteData<ActivityList>,
    QueryKey,
    string | undefined
  >({
    queryKey: orpc.activity.list.key({
      input: { filter, limit: 10 },
    }),
    queryFn: ({ pageParam }) =>
      orpc.activity.list.call({
        cursor: pageParam,
        filter,
        limit: 10,
      }),
    initialPageParam: undefined,
    initialData: initialData
      ? { pages: [initialData], pageParams: [undefined] }
      : undefined,
    getNextPageParam: (lastPage) => lastPage.rel.nextCursor ?? undefined,
  });
  /* oxlint-enable @tanstack/query/prefer-query-options */

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
        No one has recorded a tasting or updated a library recently.
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
  avatar: {
    display: "block",
    width: "32px",
    height: "32px",
    flexShrink: 0,
    borderRadius: "50%",
    objectFit: "cover",
  },
  avatarFallback: {
    display: "inline-flex",
    width: "32px",
    height: "32px",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    backgroundColor: colors.inset,
    color: colors.ink,
    fontSize: "10px",
    fontWeight: 700,
  },
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
